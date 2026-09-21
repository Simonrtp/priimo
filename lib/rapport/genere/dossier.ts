import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { EstimationObjet } from '@/lib/estimation/objet';
import type { IdentiteAgenceRapport, IdentiteAgentRapport } from '@/lib/rapport/identite';
import { nomAgentAffiche } from '@/lib/rapport/identite';
import { formatPhoneDisplay } from '@/lib/import/normalize';
import { ctaProchaineEtape, titreCouvertureAgence } from '@/lib/rapport/modele-defaut';
import { contradictionsCommentaire } from '@/lib/rapport/genere/contradictions';
import { parseRapportExclus } from '@/lib/rapport/genere/exclus';
import {
  COMPARABLES_RAYON_M,
  selectionnerComparables,
  type MutationBrute,
} from '@/lib/rapport/genere/comparables';
import { assurerFourchette, surfacePourPrixM2 } from '@/lib/rapport/genere/fourchette';
import type {
  AnnonceMarche,
  ClientRapport,
  DossierRapport,
  EffortAchat,
  EquipementProximite,
  IrisLogement,
  LigneFixe,
  LigneMobile,
  PermisUrbanisme,
  PhotoRapport,
  PointOat,
} from '@/lib/rapport/genere/types';

type Session = SupabaseClient<Database>;

function num(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

function texte(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

export async function chargerDossierRapport(
  session: Session,
  input: {
    estimation: EstimationObjet;
    agence: IdentiteAgenceRapport;
    agent: IdentiteAgentRapport;
    titreCouverture?: string | null;
    cta?: string | null;
    exclusRaw?: unknown;
  },
): Promise<DossierRapport> {
  const e = input.estimation;
  const exclus = parseRapportExclus(input.exclusRaw ?? e.context.rapportExclus);
  const surfaceCarrez = e.bien.surfaceCarrez;
  const photos: PhotoRapport[] = e.photos.map((p, i) => ({
    url: p.url,
    kind: p.kind,
    couverture: p.couverture === true || (p.kind === 'photo' && i === premierePhoto(e.photos)),
  }));
  const photoCouverture = photos.find((p) => p.couverture && p.kind === 'photo') ?? null;

  const fourchette =
    e.priceValue != null ? assurerFourchette(e.priceValue, e.priceLow, e.priceHigh) : null;
  const surfPrix = surfacePourPrixM2({ surfaceM2: e.surfaceM2, surfaceCarrez });
  let pricePerM2 = e.pricePerM2;
  if (e.priceValue != null && surfPrix && (pricePerM2 == null || e.pricePerM2 == null)) {
    pricePerM2 = Math.round(e.priceValue / surfPrix.m2);
  }

  if (fourchette?.ajoutee && e.priceValue != null) {
    await session
      .from('agency_estimations')
      .update({ price_low: fourchette.low, price_high: fourchette.high })
      .eq('id', e.id);
  }

  const [client, comparables, publicData] = await Promise.all([
    chargerClient(session, e.contactId, e.agencyId),
    chargerComparables(session, e, exclus.comparables),
    chargerPublic(session, e, exclus.annonces).catch(() => ({
      annonces: [],
      annoncesReserve: [],
      iris: null,
      equipements: [],
      fixe: [],
      mobile: [],
      permis: [],
      oat: [],
      effort: null,
      fluiditeJoursMedian: null,
      negotiationPctMedian: null,
    })),
  ]);

  return {
    titreCouverture: titreCouvertureAgence(input.titreCouverture),
    ctaProchaineEtape: ctaProchaineEtape(input.cta),
    dateEvaluation: e.dateValeur ?? e.updatedAt,
    adresse: e.address,
    city: e.city,
    postalCode: e.postalCode,
    propertyType: e.propertyType,
    surfaceM2: e.surfaceM2,
    surfaceCarrez,
    rooms: e.rooms,
    floor: e.floor,
    occupation: e.occupation,
    dpeClass: e.dpeClass,
    commentairesPublics: e.commentairesPublics,
    remarquesExpert: e.remarquesExpert,
    etagesImmeuble: e.bien.etagesImmeuble,
    anneeConstruction: e.bien.anneeConstruction,
    ascenseur: e.bien.ascenseur,
    chambres: e.bien.chambres,
    annexes: e.annexes.map((a) => ({ libelle: a.libelle, surfaceM2: a.surfaceM2 })),
    photos,
    photoCouverture,
    latitude: e.latitude,
    longitude: e.longitude,
    priceValue: e.priceValue,
    priceLow: fourchette?.low ?? e.priceLow,
    priceHigh: fourchette?.high ?? e.priceHigh,
    pricePerM2,
    surfacePrixLibelle: surfPrix?.libelle ?? null,
    fourchetteAjoutee: fourchette?.ajoutee ?? false,
    client,
    agence: input.agence,
    agent: input.agent,
    comparables: comparables.retenues,
    comparablesReserve: comparables.reserve,
    annonces: publicData.annonces,
    annoncesReserve: publicData.annoncesReserve,
    iris: publicData.iris,
    equipements: publicData.equipements,
    fixe: publicData.fixe,
    mobile: publicData.mobile,
    permis: publicData.permis,
    oat: publicData.oat,
    effort: publicData.effort,
    fluiditeJoursMedian: publicData.fluiditeJoursMedian,
    negotiationPctMedian: publicData.negotiationPctMedian,
    contradictions: contradictionsCommentaire({
      commentaire: e.commentairesPublics,
      ascenseur: e.bien.ascenseur,
      floor: e.floor,
      surfaceM2: e.surfaceM2,
      dpeClass: e.dpeClass,
    }),
  };
}

function premierePhoto(photos: EstimationObjet['photos']): number {
  return photos.findIndex((p) => p.kind === 'photo');
}

async function chargerClient(
  session: Session,
  contactId: string | null,
  agencyId: string,
): Promise<ClientRapport> {
  if (!contactId) return { nom: null, telephone: null, email: null };
  const { data } = await session
    .from('contacts')
    .select('first_name, last_name, phone, email')
    .eq('id', contactId)
    .eq('agency_id', agencyId)
    .maybeSingle();
  return {
    nom: nomAgentAffiche(data?.first_name, data?.last_name),
    telephone: data?.phone ? formatPhoneDisplay(data.phone) : null,
    email: data?.email?.trim() || null,
  };
}

async function chargerComparables(
  session: Session,
  e: EstimationObjet,
  exclus: string[],
): Promise<{ retenues: ReturnType<typeof selectionnerComparables>['retenues']; reserve: ReturnType<typeof selectionnerComparables>['reserve'] }> {
  if (!e.propertyType || !e.surfaceM2 || !e.postalCode || e.latitude == null || e.longitude == null) {
    return { retenues: [], reserve: [] };
  }
  const lat = e.latitude;
  const lng = e.longitude;
  const latDelta = COMPARABLES_RAYON_M / 111_320;
  const lngDelta = COMPARABLES_RAYON_M / (111_320 * Math.cos((lat * Math.PI) / 180));

  const { data: near } = await session
    .from('buildings')
    .select('ban_id, parcelle_id, lat, lng, code_postal')
    .eq('code_postal', e.postalCode)
    .gte('lat', lat - latDelta)
    .lte('lat', lat + latDelta)
    .gte('lng', lng - lngDelta)
    .lte('lng', lng + lngDelta)
    .limit(400);

  let buildings = (near ?? []) as Array<{
    ban_id: string;
    parcelle_id: string | null;
    lat: number | null;
    lng: number | null;
    code_postal: string | null;
  }>;

  if (buildings.length < 8) {
    const { data: commune } = await session
      .from('buildings')
      .select('ban_id, parcelle_id, lat, lng, code_postal')
      .eq('code_postal', e.postalCode)
      .limit(500);
    buildings = (commune ?? []) as typeof buildings;
  }

  const geo = new Map(buildings.map((b) => [b.ban_id, b]));
  const parcelleIds = [...new Set(buildings.map((b) => b.parcelle_id).filter(Boolean))] as string[];
  const banIds = [...new Set(buildings.map((b) => b.ban_id))];

  let tx: Array<Record<string, unknown>> = [];
  if (parcelleIds.length > 0) {
    const { data } = await session
      .from('building_transactions')
      .select(
        'id, id_mutation, ban_id, parcelle_id, date_mutation, valeur_fonciere, surface_reelle_bati, nombre_pieces, type_local, prix_m2, code_postal',
      )
      .in('parcelle_id', parcelleIds.slice(0, 250))
      .order('date_mutation', { ascending: false })
      .limit(800);
    tx = (data ?? []) as Array<Record<string, unknown>>;
  } else if (banIds.length > 0) {
    const { data } = await session
      .from('building_transactions')
      .select(
        'id, id_mutation, ban_id, parcelle_id, date_mutation, valeur_fonciere, surface_reelle_bati, nombre_pieces, type_local, prix_m2, code_postal',
      )
      .in('ban_id', banIds.slice(0, 250))
      .order('date_mutation', { ascending: false })
      .limit(800);
    tx = (data ?? []) as Array<Record<string, unknown>>;
  }

  const rows: MutationBrute[] = tx.map((r, i) => {
    const ban = texte(r.ban_id);
    const geoRow = ban ? geo.get(ban) : undefined;
    return {
      id: texte(r.id) ?? `tx-${i}`,
      idMutation: texte(r.id_mutation),
      dateMutation: texte(r.date_mutation) ?? '',
      valeurFonciere: num(r.valeur_fonciere),
      surfaceM2: num(r.surface_reelle_bati),
      pieces: num(r.nombre_pieces),
      typeLocal: texte(r.type_local),
      codePostal: texte(r.code_postal) ?? geoRow?.code_postal ?? e.postalCode,
      banId: ban,
      parcelleId: texte(r.parcelle_id),
      latitude: geoRow?.lat ?? null,
      longitude: geoRow?.lng ?? null,
    };
  });

  return selectionnerComparables(rows, {
    propertyType: e.propertyType,
    surfaceM2: e.surfaceM2,
    codePostal: e.postalCode,
    latitude: lat,
    longitude: lng,
    exclus,
  });
}

type PublicPack = {
  annonces: AnnonceMarche[];
  annoncesReserve: AnnonceMarche[];
  iris: IrisLogement | null;
  equipements: EquipementProximite[];
  fixe: LigneFixe[];
  mobile: LigneMobile[];
  permis: PermisUrbanisme[];
  oat: PointOat[];
  effort: EffortAchat | null;
  fluiditeJoursMedian: number | null;
  negotiationPctMedian: number | null;
};

async function chargerPublic(
  session: Session,
  e: EstimationObjet,
  exclusAnnonces: string[],
): Promise<PublicPack> {
  const vide: PublicPack = {
    annonces: [],
    annoncesReserve: [],
    iris: null,
    equipements: [],
    fixe: [],
    mobile: [],
    permis: [],
    oat: [],
    effort: null,
    fluiditeJoursMedian: null,
    negotiationPctMedian: null,
  };
  const cp = e.postalCode;
  if (!cp) return vide;

  const pub = session as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (a: string, b: string) => ReturnType<typeof eqChain>;
        order: (c: string, o: { ascending: boolean }) => { limit: (n: number) => Promise<{ data: unknown }>; };
        limit: (n: number) => Promise<{ data: unknown }>;
      };
    };
  };
  function eqChain(this: unknown) {
    return this as {
      eq: (a: string, b: string) => ReturnType<typeof eqChain>;
      order: (c: string, o: { ascending: boolean }) => {
        limit: (n: number) => Promise<{ data: unknown }>;
      };
      maybeSingle: () => Promise<{ data: unknown }>;
      limit: (n: number) => Promise<{ data: unknown }>;
    };
  }

  const q = (table: string, cols: string) => pub.from(table).select(cols);

  const irisPromise = (async () => {
    let irisCode: string | null = null;
    if (e.banId) {
      const { data } = await q('iris_adresses', 'iris_code').eq('ban_id', e.banId).maybeSingle();
      irisCode = texte((data as { iris_code?: string } | null)?.iris_code);
    }
    if (!irisCode && e.parcelleId) {
      const { data } = await q('iris_adresses', 'iris_code').eq('parcelle_id', e.parcelleId).maybeSingle();
      irisCode = texte((data as { iris_code?: string } | null)?.iris_code);
    }
    if (!irisCode) return null;
    const { data } = await q(
      'iris_logement',
      'iris_code, commune, part_appartements, pieces_dominant, epoque_construction_dominante, part_proprietaires, part_locataires',
    )
      .eq('iris_code', irisCode)
      .maybeSingle();
    const row = data as Record<string, unknown> | null;
    if (!row) return null;
    return {
      irisCode,
      commune: texte(row.commune),
      partAppartements: num(row.part_appartements),
      piecesDominant: num(row.pieces_dominant),
      epoque: texte(row.epoque_construction_dominante),
      partProprietaires: num(row.part_proprietaires),
      partLocataires: num(row.part_locataires),
    } satisfies IrisLogement;
  })();

  const annoncesPromise = q(
    'annonces_marche',
    'id, type_local, surface_m2, pieces, prix, prix_m2, date_releve, date_premiere_vue, prix_initial, statut',
  )
    .eq('code_postal', cp)
    .order('date_releve', { ascending: false })
    .limit(80);

  const poiQ = e.banId
    ? q('equipements_proximite', 'id, categorie, nom, distance_m, latitude, longitude').eq('ban_id', e.banId)
    : e.parcelleId
      ? q('equipements_proximite', 'id, categorie, nom, distance_m, latitude, longitude').eq(
          'parcelle_id',
          e.parcelleId,
        )
      : q('equipements_proximite', 'id, categorie, nom, distance_m, latitude, longitude').eq('code_postal', cp);

  const fixeQ = e.banId
    ? q('connectivite_fixe', 'technologie, operateur, eligible, debit_max_mbps').eq('ban_id', e.banId)
    : e.parcelleId
      ? q('connectivite_fixe', 'technologie, operateur, eligible, debit_max_mbps').eq('parcelle_id', e.parcelleId)
      : q('connectivite_fixe', 'technologie, operateur, eligible, debit_max_mbps').eq('code_postal', cp);

  const mobileQ = e.banId
    ? q('connectivite_mobile', 'operateur, generation, niveau').eq('ban_id', e.banId)
    : e.parcelleId
      ? q('connectivite_mobile', 'operateur, generation, niveau').eq('parcelle_id', e.parcelleId)
      : q('connectivite_mobile', 'operateur, generation, niveau').eq('code_postal', cp);

  const [
    iris,
    annoncesRes,
    poiRes,
    fixeRes,
    mobileRes,
    permisRes,
    oatRes,
    effortRes,
  ] = await Promise.all([
    irisPromise,
    annoncesPromise,
    poiQ.order('distance_m', { ascending: true }).limit(40),
    fixeQ.limit(40),
    mobileQ.limit(40),
    q(
      'permis_urbanisme',
      'id, numero, type_autorisation, date_decision, adresse, commune, distance_m, latitude, longitude',
    )
      .eq('code_postal', cp)
      .order('date_decision', { ascending: false })
      .limit(20),
    q('taux_oat', 'date, taux').order('date', { ascending: false }).limit(60),
    q(
      'effort_achat',
      'annees_revenu_median_secteur, annees_revenu_median_departement, annees_revenu_median_france',
    )
      .eq('code_postal', cp)
      .maybeSingle(),
  ]);

  const toutesAnnonces = ((annoncesRes.data as Array<Record<string, unknown>> | null) ?? [])
    .map(mapAnnonce)
    .filter((a): a is AnnonceMarche => a != null);
  const actives = toutesAnnonces.filter((a) => a.statut === 'active');
  const exclusSet = new Set(exclusAnnonces);
  const annonces = actives.filter((a) => !exclusSet.has(a.id));
  const annoncesReserve = actives.filter((a) => exclusSet.has(a.id));

  const historiques = toutesAnnonces.filter((a) => a.datePremiereVue && a.dateReleve);
  const delais = historiques
    .map((a) => {
      const a0 = Date.parse(a.datePremiereVue!);
      const a1 = Date.parse(a.dateReleve);
      return Number.isFinite(a0) && Number.isFinite(a1) ? (a1 - a0) / 86_400_000 : null;
    })
    .filter((n): n is number => n != null && n >= 0);
  const nego = toutesAnnonces
    .map((a) => {
      if (a.prix == null || a.prixInitial == null || a.prixInitial <= 0 || a.prix >= a.prixInitial) return null;
      return ((a.prixInitial - a.prix) / a.prixInitial) * 100;
    })
    .filter((n): n is number => n != null);

  const effortRow = effortRes.data as Record<string, unknown> | null;

  return {
    annonces,
    annoncesReserve,
    iris,
    equipements: ((poiRes.data as Array<Record<string, unknown>> | null) ?? [])
      .map(mapPoi)
      .filter((p): p is EquipementProximite => p != null),
    fixe: ((fixeRes.data as Array<Record<string, unknown>> | null) ?? []).map((r) => ({
      technologie: texte(r.technologie) ?? '',
      operateur: texte(r.operateur) ?? '',
      eligible: r.eligible === true,
      debitMaxMbps: num(r.debit_max_mbps),
    })),
    mobile: ((mobileRes.data as Array<Record<string, unknown>> | null) ?? []).map((r) => ({
      operateur: texte(r.operateur) ?? '',
      generation: (texte(r.generation) as LigneMobile['generation']) ?? '4g',
      niveau: (texte(r.niveau) as LigneMobile['niveau']) ?? 'moyenne',
    })),
    permis: ((permisRes.data as Array<Record<string, unknown>> | null) ?? [])
      .map(mapPermis)
      .filter((p): p is PermisUrbanisme => p != null),
    oat: ((oatRes.data as Array<Record<string, unknown>> | null) ?? [])
      .map((r) => {
        const date = texte(r.date);
        const taux = num(r.taux);
        return date && taux != null ? { date, taux } : null;
      })
      .filter((p): p is PointOat => p != null)
      .reverse(),
    effort: effortRow
      ? {
          secteur: num(effortRow.annees_revenu_median_secteur),
          departement: num(effortRow.annees_revenu_median_departement),
          france: num(effortRow.annees_revenu_median_france),
        }
      : null,
    fluiditeJoursMedian: mediane(delais),
    negotiationPctMedian: mediane(nego),
  };
}

function mapAnnonce(r: Record<string, unknown>): AnnonceMarche | null {
  const id = texte(r.id);
  const dateReleve = texte(r.date_releve);
  if (!id || !dateReleve) return null;
  const statut = r.statut === 'vendue' || r.statut === 'retiree' ? r.statut : 'active';
  return {
    id,
    typeLocal: texte(r.type_local),
    surfaceM2: num(r.surface_m2),
    pieces: num(r.pieces),
    prix: num(r.prix),
    prixM2: num(r.prix_m2),
    dateReleve,
    datePremiereVue: texte(r.date_premiere_vue),
    prixInitial: num(r.prix_initial),
    statut,
  };
}

function mapPoi(r: Record<string, unknown>): EquipementProximite | null {
  const id = texte(r.id);
  const nom = texte(r.nom);
  const categorie = texte(r.categorie);
  const distanceM = num(r.distance_m);
  if (!id || !nom || !categorie || distanceM == null) return null;
  if (!['administration', 'enseignement', 'transports', 'sante'].includes(categorie)) return null;
  return {
    id,
    categorie: categorie as EquipementProximite['categorie'],
    nom,
    distanceM,
    latitude: num(r.latitude),
    longitude: num(r.longitude),
  };
}

function mapPermis(r: Record<string, unknown>): PermisUrbanisme | null {
  const id = texte(r.id);
  const numero = texte(r.numero);
  if (!id || !numero) return null;
  return {
    id,
    numero,
    type: texte(r.type_autorisation),
    dateDecision: texte(r.date_decision),
    adresse: texte(r.adresse),
    commune: texte(r.commune),
    distanceM: num(r.distance_m),
    latitude: num(r.latitude),
    longitude: num(r.longitude),
  };
}

function mediane(values: number[]): number | null {
  if (values.length < 3) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}
