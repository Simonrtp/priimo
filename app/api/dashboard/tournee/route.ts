import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { estEnAttente } from '@/lib/billing/acces';
import { viewerFromProfile } from '@/lib/agency/visibility';
import { visibleLeadsFor } from '@/lib/agency/scope-records';
import { toGeoCoord, type GeoCoord } from '@/lib/carte/coords';
import { fetchLeads } from '@/lib/queries/leads';
import { fetchLeadStages } from '@/lib/queries/lead-stages';
import { fetchPassagesObserves } from '@/lib/queries/passages';
import { boiteAutour, chargerDpeRecents } from '@/lib/queries/tournee';
import { fetchZonesSafe } from '@/lib/queries/zones';
import { dateKeyParis } from '@/lib/today/calendar';
import { isLeadForSortie } from '@/lib/today/sortie';
import {
  FENETRE_DPE_JOURS,
  adresseDansSecteur,
  adresseLibre,
  dejaProspectee,
  derniersPassagesAgence,
  genererTournee,
  rayonTourneeM,
  regrouperAdresses,
  secteurDeTournee,
  versArretSortie,
  type AdresseTournee,
  type LeadTournee,
} from '@/lib/tournee/generer';
import {
  MAX_ADRESSES_IMPOSEES,
  type PerimetreTournee,
  type TourneeReponse,
} from '@/lib/tournee/reglages';
import { bboxDeZone, type Bbox } from '@/lib/zones/geometrie';
import type { Zone } from '@/lib/zones/types';

export const runtime = 'nodejs';
export const maxDuration = 30;

type AdresseDemandee = {
  label: string;
  latitude: number;
  longitude: number;
  banId: string | null;
  codePostal: string | null;
};

type Demande = {
  dureeMinutes: number;
  zoneId: string | null;
  perimetre: PerimetreTournee;
  ancres: AdresseDemandee[];
  position: GeoCoord | null;
};

function lireCoord(valeur: unknown): GeoCoord | null {
  if (!valeur || typeof valeur !== 'object') return null;
  const v = valeur as Record<string, unknown>;
  return toGeoCoord(
    typeof v.latitude === 'number' ? v.latitude : null,
    typeof v.longitude === 'number' ? v.longitude : null,
  );
}

function texteCourt(valeur: unknown, max = 64): string | null {
  if (typeof valeur !== 'string') return null;
  const t = valeur.trim();
  return t && t.length <= max ? t : null;
}

function lireAdresse(valeur: unknown): AdresseDemandee | null {
  if (!valeur || typeof valeur !== 'object') return null;
  const a = valeur as Record<string, unknown>;
  const coord = lireCoord(a);
  const label = texteCourt(a.label, 200);
  if (!coord || !label) return null;
  const codePostal = texteCourt(a.codePostal, 5);
  return {
    label,
    ...coord,
    banId: texteCourt(a.banId),
    codePostal: codePostal && /^\d{5}$/.test(codePostal) ? codePostal : null,
  };
}

function lireDemande(corps: unknown): Demande | null {
  if (!corps || typeof corps !== 'object') return null;
  const c = corps as Record<string, unknown>;
  const duree = typeof c.dureeMinutes === 'number' ? Math.round(c.dureeMinutes) : Number.NaN;
  if (!(duree >= 15 && duree <= 240)) return null;
  const brutes = Array.isArray(c.ancres) ? c.ancres.slice(0, MAX_ADRESSES_IMPOSEES) : [];
  const ancres = brutes.map(lireAdresse);
  if (ancres.some((a) => a === null)) return null;
  return {
    dureeMinutes: duree,
    zoneId: texteCourt(c.zoneId),
    perimetre: c.perimetre === 'code_postal' ? 'code_postal' : 'secteur',
    ancres: ancres as AdresseDemandee[],
    position: lireCoord(c.position),
  };
}

/** Un secteur tracé à la rue ou au code postal dit lui-même où chercher ; un contour, non. */
function codesDuSecteur(secteur: Zone | null, codesAgence: readonly string[]): string[] {
  if (!secteur) return [...codesAgence];
  const codesRegles: string[] = [];
  let contour = false;
  for (const regle of secteur.regles) {
    if (!regle.inclusion) continue;
    if (regle.type === 'polygone') contour = true;
    if (regle.type === 'code_postal' || regle.type === 'voie') codesRegles.push(regle.valeur.code_postal.trim());
  }
  const valides = codesRegles.filter((c) => /^\d{5}$/.test(c));
  if (!contour && valides.length > 0) return [...new Set(valides)];
  return [...new Set([...codesAgence, ...valides])];
}

function boiteCommune(boites: readonly Bbox[]): Bbox | null {
  if (boites.length === 0) return null;
  return {
    ouest: Math.min(...boites.map((b) => b.ouest)),
    sud: Math.min(...boites.map((b) => b.sud)),
    est: Math.max(...boites.map((b) => b.est)),
    nord: Math.max(...boites.map((b) => b.nord)),
  };
}

export async function POST(req: Request) {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Reconnecte-toi pour préparer ta tournée.' }, { status: 401 });
  }
  if (estEnAttente(agency)) {
    return NextResponse.json(
      { error: 'Ton agence n’est pas encore validée : la tournée arrive très vite.' },
      { status: 403 },
    );
  }

  const demande = lireDemande(await req.json().catch(() => null));
  if (!demande) {
    return NextResponse.json({ error: 'Oups, ça n’a pas marché. Réessaie !' }, { status: 400 });
  }

  const maintenant = new Date();
  const directeur = profile.role === 'directeur';
  const supabase = await createSupabaseServerClient();
  const [zones, leads, stages] = await Promise.all([
    fetchZonesSafe(supabase),
    fetchLeads(supabase),
    fetchLeadStages(supabase),
  ]);

  const actives = zones.filter((z) => z.actif);
  const secteur =
    demande.perimetre === 'secteur'
      ? secteurDeTournee({ zones: actives, profileId: profile.id, directeur, zoneId: demande.zoneId, maintenant })
      : null;
  const codesAgence = (agency.codes_postaux ?? []).filter((c) => /^\d{5}$/.test(c));
  const agence = toGeoCoord(agency.latitude, agency.longitude);
  const rayon = rayonTourneeM(demande.dureeMinutes) + 300;
  const pointConnu = demande.position ?? agence;
  const zone =
    demande.ancres.length > 0
      ? boiteCommune(demande.ancres.map((a) => boiteAutour(a, rayon)))
      : secteur
        ? bboxDeZone(secteur)
        : null;

  const [passages, dpes] = await Promise.all([
    fetchPassagesObserves({ supabase, stages, maintenant }),
    chargerDpeRecents({
      openData: createSupabaseAdminClient(),
      codesPostaux: codesDuSecteur(secteur, codesAgence),
      depuis: dateKeyParis(new Date(maintenant.getTime() - FENETRE_DPE_JOURS * 86_400_000)),
      zone,
      voisinage: pointConnu ? boiteAutour(pointConnu, rayon) : null,
    }),
  ]);

  // Un lead clos, ou celui d'un collègue, ferme toute l'adresse.
  const adressesFermees = new Set(
    leads.filter((l) => l.banId && !isLeadForSortie(l, profile.id)).map((l) => l.banId!),
  );
  const leadsTournee: LeadTournee[] = [];
  for (const lead of visibleLeadsFor(viewerFromProfile(profile), leads)) {
    const coord = toGeoCoord(lead.latitude, lead.longitude);
    if (!lead.banId || !coord || !isLeadForSortie(lead, profile.id)) continue;
    leadsTournee.push({
      id: lead.id,
      banId: lead.banId,
      adresse: lead.address,
      codePostal: lead.postalCode,
      ...coord,
      score: lead.score,
      signal: lead.mainSignalLabel,
      dpeDate: lead.dpeDate,
      dpeLettre: lead.dpeClass,
      surfaceM2: lead.surfaceM2,
    });
  }

  const toutes = regrouperAdresses({ dpes, leads: leadsTournee, passages: derniersPassagesAgence(passages) });
  const contexte = {
    secteur,
    zones: actives,
    profileId: profile.id,
    directeur,
    codesPostaux: new Set(codesAgence),
    exclureCollegues: demande.perimetre === 'secteur',
  };
  const duPerimetre = toutes.filter(
    (a) => !(a.banId && adressesFermees.has(a.banId)) && adresseDansSecteur(a, contexte),
  );
  const aFaire = duPerimetre.filter((a) => !dejaProspectee(a, maintenant));

  const ancres: AdresseTournee[] = [];
  for (const demandee of demande.ancres) {
    const connue = demandee.banId ? toutes.find((a) => a.banId === demandee.banId) : undefined;
    const ancre = connue ?? adresseLibre(demandee);
    if (!ancres.some((a) => a.key === ancre.key)) ancres.push(ancre);
  }
  const clesAncres = new Set(ancres.map((a) => a.key));

  const tournee = genererTournee({
    adresses: aFaire,
    ancres,
    position: demande.position,
    agence,
    budgetMinutes: demande.dureeMinutes,
    maintenant,
  });

  const reponse: TourneeReponse = {
    arrets: tournee.arrets.map((a) => versArretSortie(a, maintenant, { choisie: clesAncres.has(a.key) })),
    depart: tournee.depart,
    departSource: tournee.departSource,
    distanceDepartM: tournee.distanceDepartM,
    minutes: Math.round(tournee.minutes),
    distanceM: Math.round(tournee.distanceM),
    secteur: secteur?.nom ?? null,
    adressesAFaire: aFaire.length,
    dejaFaites: duPerimetre.length - aFaire.length,
  };
  return NextResponse.json(reponse);
}
