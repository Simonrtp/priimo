import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { GeoCoord } from '@/lib/carte/coords';
import { toGeoCoord } from '@/lib/carte/coords';
import { fetchDpeSecteur } from '@/lib/geo/ademe';
import type { DpeTournee } from '@/lib/tournee/generer';
import type { Bbox } from '@/lib/zones/geometrie';

type Client = SupabaseClient<Database>;

const TAILLE_ADEME_PAR_CP = 1_500;
const DELAI_ADEME_MS = 9_000;
const CODES_POSTAUX_MAX = 8;
const BATIMENTS_MAX = 4_000;
const PAQUET_BAN = 200;
const PAQUETS_EN_PARALLELE = 5;
const METRES_PAR_DEGRE = 111_320;

type Batiment = GeoCoord & { adresse: string; codePostal: string | null; parcelleId: string | null };

export function boiteAutour(centre: GeoCoord, rayonM: number): Bbox {
  const dLat = rayonM / METRES_PAR_DEGRE;
  const dLng = rayonM / (METRES_PAR_DEGRE * Math.max(0.2, Math.cos((centre.latitude * Math.PI) / 180)));
  return {
    ouest: centre.longitude - dLng,
    sud: centre.latitude - dLat,
    est: centre.longitude + dLng,
    nord: centre.latitude + dLat,
  };
}

function dansBoite(p: GeoCoord, boite: Bbox): boolean {
  return p.latitude >= boite.sud && p.latitude <= boite.nord && p.longitude >= boite.ouest && p.longitude <= boite.est;
}

async function batimentsDansBoite(
  db: Client,
  codes: readonly string[],
  boite: Bbox,
): Promise<{ batiments: Map<string, Batiment>; tronque: boolean }> {
  const { data, error } = await db
    .from('buildings')
    .select('ban_id, adresse, code_postal, lat, lng, parcelle_id')
    .in('code_postal', [...codes])
    .gte('lat', boite.sud)
    .lte('lat', boite.nord)
    .gte('lng', boite.ouest)
    .lte('lng', boite.est)
    .limit(BATIMENTS_MAX);
  const batiments = new Map<string, Batiment>();
  if (error) {
    console.error('[tournee] immeubles', error.message);
    return { batiments, tronque: false };
  }
  const lignes = (data ?? []) as {
    ban_id: string | null;
    adresse: string | null;
    code_postal: string | null;
    lat: number | null;
    lng: number | null;
    parcelle_id: string | null;
  }[];
  for (const b of lignes) {
    const coord = toGeoCoord(b.lat, b.lng);
    const adresse = b.adresse?.trim();
    if (!b.ban_id || !coord || !adresse || batiments.has(b.ban_id)) continue;
    batiments.set(b.ban_id, { ...coord, adresse, codePostal: b.code_postal, parcelleId: b.parcelle_id });
  }
  return { batiments, tronque: lignes.length >= BATIMENTS_MAX };
}

/** La copie en base a quelques semaines de retard, mais ne dépend pas de l'ADEME. */
async function dpeDesBatiments(db: Client, batiments: ReadonlyMap<string, Batiment>, depuis: string): Promise<DpeTournee[]> {
  const banIds = [...batiments.keys()];
  const paquets: string[][] = [];
  for (let i = 0; i < banIds.length; i += PAQUET_BAN) paquets.push(banIds.slice(i, i + PAQUET_BAN));

  const out: DpeTournee[] = [];
  for (let i = 0; i < paquets.length; i += PAQUETS_EN_PARALLELE) {
    const pages = await Promise.all(
      paquets.slice(i, i + PAQUETS_EN_PARALLELE).map(async (paquet) => {
        const { data, error } = await db
          .from('building_dpe')
          .select('ban_id, numero_dpe, date_dpe, etiquette_dpe, surface')
          .in('ban_id', paquet)
          .gte('date_dpe', depuis);
        if (error) {
          console.error('[tournee] building_dpe', error.message);
          return [];
        }
        return (data ?? []) as {
          ban_id: string;
          numero_dpe: string | null;
          date_dpe: string | null;
          etiquette_dpe: string | null;
          surface: number | string | null;
        }[];
      }),
    );
    for (const page of pages) {
      for (const ligne of page) {
        const batiment = batiments.get(ligne.ban_id);
        const date = ligne.date_dpe?.slice(0, 10);
        if (!batiment || !date) continue;
        const surface = ligne.surface === null ? null : Number(ligne.surface);
        out.push({
          numeroDpe: ligne.numero_dpe,
          banId: ligne.ban_id,
          adresse: batiment.adresse,
          codePostal: batiment.codePostal,
          latitude: batiment.latitude,
          longitude: batiment.longitude,
          date,
          lettre: ligne.etiquette_dpe,
          surfaceM2: surface !== null && Number.isFinite(surface) ? surface : null,
          typeBatiment: null,
          parcelleId: batiment.parcelleId,
        });
      }
    }
  }
  return out;
}

async function dpeAdeme(codes: readonly string[], depuis: string, boite: Bbox | null): Promise<DpeTournee[]> {
  const lignes = await fetchDpeSecteur(codes, depuis, AbortSignal.timeout(DELAI_ADEME_MS), {
    taille: TAILLE_ADEME_PAR_CP,
    cached: true,
  });
  const out: DpeTournee[] = [];
  for (const l of lignes) {
    const coord = toGeoCoord(l.latitude, l.longitude);
    const banId = l.identifiantBan?.trim();
    if (!coord || !banId || l.dateEtablissement < depuis) continue;
    if (boite && !dansBoite(coord, boite)) continue;
    out.push({
      numeroDpe: l.numeroDpe,
      banId,
      adresse: l.adresse,
      codePostal: l.codePostal,
      latitude: coord.latitude,
      longitude: coord.longitude,
      date: l.dateEtablissement,
      lettre: l.lettre,
      surfaceM2: l.surfaceM2,
      typeBatiment: l.typeBatiment,
      parcelleId: null,
    });
  }
  return out;
}

/** `zone` borne aussi l'ADEME (adresse imposée, contour du secteur) ; `voisinage` ne sert qu'à la copie en base. */
export async function chargerDpeRecents(params: {
  openData: Client;
  codesPostaux: readonly string[];
  depuis: string;
  zone: Bbox | null;
  voisinage: Bbox | null;
}): Promise<DpeTournee[]> {
  const codes = [...new Set(params.codesPostaux.filter((c) => /^\d{5}$/.test(c)))];
  if (codes.length === 0) return [];

  const boiteBase = params.zone ?? params.voisinage;
  const { batiments, tronque } = boiteBase
    ? await batimentsDansBoite(params.openData, codes, boiteBase)
    : { batiments: new Map<string, Batiment>(), tronque: false };

  // Le contour dit quels codes postaux interroger : inutile de lire tout le territoire.
  let codesAdeme = codes;
  if (params.zone && batiments.size > 0 && !tronque) {
    const presents = new Set([...batiments.values()].map((b) => b.codePostal));
    codesAdeme = codes.filter((c) => presents.has(c));
  }

  const [ademe, base] = await Promise.all([
    dpeAdeme(codesAdeme.slice(0, CODES_POSTAUX_MAX), params.depuis, params.zone),
    dpeDesBatiments(params.openData, batiments, params.depuis),
  ]);
  return [...ademe, ...base];
}
