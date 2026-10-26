import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, ZoneRegleRow, ZoneRow } from '@/types/database';
import {
  TYPES_REGLE_ZONE,
  type RegleZone,
  type ValeurPolygone,
  type Zone,
} from '@/lib/zones/types';

type Client = SupabaseClient<Database>;

const ZONES_SELECT =
  'id, agency_id, nom, couleur, assigned_to, jours_semaine, actif, verrouillee, created_at, updated_at';
/** Avant la migration des jours multiples : un seul jour, en colonne scalaire. */
const ZONES_SELECT_JOUR_UNIQUE =
  'id, agency_id, nom, couleur, assigned_to, jour_semaine, actif, verrouillee, created_at, updated_at';
const REGLES_SELECT = 'id, zone_id, type, valeur, inclusion, created_at';

function estObjet(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function estAnneau(v: unknown): boolean {
  return (
    Array.isArray(v) &&
    v.length >= 3 &&
    v.every(
      (p) =>
        Array.isArray(p) &&
        p.length >= 2 &&
        typeof p[0] === 'number' &&
        typeof p[1] === 'number',
    )
  );
}

/**
 * Une règle mal formée est ignorée, jamais devinée. Le jsonb vient de la base :
 * une valeur cassée doit rétrécir le périmètre d'une zone, pas faire tomber
 * l'écran ni attribuer un lead au hasard.
 */
function versRegle(row: ZoneRegleRow): RegleZone | null {
  if (!(TYPES_REGLE_ZONE as readonly string[]).includes(row.type)) return null;
  const valeur = row.valeur;
  if (!estObjet(valeur)) return null;
  const base = { id: row.id, zoneId: row.zone_id, inclusion: row.inclusion };

  switch (row.type) {
    case 'polygone': {
      const anneaux = valeur.coordinates;
      if (!Array.isArray(anneaux) || anneaux.length === 0) return null;
      if (!anneaux.every(estAnneau)) return null;
      return {
        ...base,
        type: 'polygone',
        valeur: {
          type: 'Polygon',
          coordinates: anneaux as ValeurPolygone['coordinates'],
        },
      };
    }
    case 'voie': {
      const nom = valeur.nom_voie;
      const cp = valeur.code_postal;
      const parite = valeur.parite;
      if (typeof nom !== 'string' || nom.trim() === '') return null;
      if (typeof cp !== 'string') return null;
      if (parite !== 'toutes' && parite !== 'paires' && parite !== 'impaires') return null;
      const borne = (v: unknown): number | null => (typeof v === 'number' ? v : null);
      return {
        ...base,
        type: 'voie',
        valeur: {
          nom_voie: nom,
          code_postal: cp,
          parite,
          numero_min: borne(valeur.numero_min),
          numero_max: borne(valeur.numero_max),
        },
      };
    }
    case 'code_postal': {
      const cp = valeur.code_postal;
      if (typeof cp !== 'string' || !/^\d{5}$/.test(cp.trim())) return null;
      return { ...base, type: 'code_postal', valeur: { code_postal: cp.trim() } };
    }
    case 'parcelles': {
      const ids = valeur.parcelle_ids;
      if (!Array.isArray(ids)) return null;
      const propres = ids.filter((id): id is string => typeof id === 'string' && id !== '');
      if (propres.length === 0) return null;
      return { ...base, type: 'parcelles', valeur: { parcelle_ids: propres } };
    }
    default:
      return null;
  }
}

/** Trié et dédoublonné à la lecture : la base peut avoir été écrite à la main. */
function joursDeLaLigne(row: ZoneRow): number[] {
  const bruts = Array.isArray(row.jours_semaine)
    ? row.jours_semaine
    : row.jour_semaine != null
      ? [row.jour_semaine]
      : [];
  const jours = new Set<number>();
  for (const j of bruts) {
    if (Number.isInteger(j) && j >= 1 && j <= 5) jours.add(j);
  }
  return [...jours].sort((a, b) => a - b);
}

/** L'enveloppe calculée par le serveur : des polygones GeoJSON, ou rien. */
function enveloppeDeLaLigne(brute: unknown): ValeurPolygone[] | undefined {
  if (!Array.isArray(brute)) return undefined;
  const polygones = brute.filter(
    (p): p is ValeurPolygone =>
      estObjet(p) && Array.isArray(p.coordinates) && p.coordinates.length > 0 && p.coordinates.every(estAnneau),
  );
  return polygones.length > 0 ? polygones.map((p) => ({ type: 'Polygon', coordinates: p.coordinates })) : undefined;
}

function versZone(
  row: ZoneRow & { enveloppe?: unknown },
  regles: readonly RegleZone[],
  couleurTitulaire: string | null,
): Zone {
  const enveloppe = enveloppeDeLaLigne(row.enveloppe);
  return {
    id: row.id,
    agencyId: row.agency_id,
    nom: row.nom,
    // Chaque collaborateur a sa couleur : ses secteurs la portent tous.
    couleur: couleurTitulaire ?? row.couleur,
    assignedTo: row.assigned_to,
    joursSemaine: joursDeLaLigne(row),
    actif: row.actif,
    verrouillee: row.verrouillee === true,
    regles,
    ...(enveloppe ? { enveloppe } : {}),
  };
}

type ClientLibre = SupabaseClient;

/**
 * Les parcelles de chaque secteur (table `zone_parcelles`), sous la forme
 * d'une règle « parcelles » : l'appartenance n'a pas à savoir d'où elle vient.
 * Avant la migration du 26/10/2026, la vue n'existe pas : aucun secteur n'a
 * encore de parcelles.
 */
async function lireParcellesDesZones(supabase: Client, zoneIds: readonly string[]): Promise<Map<string, string[]>> {
  const parZone = new Map<string, string[]>();
  const { data, error } = await (supabase as unknown as ClientLibre)
    .from('zone_parcelles_listes')
    .select('zone_id, parcelle_ids')
    .in('zone_id', [...zoneIds]);
  if (error) {
    if (!/zone_parcelles_listes/.test(error.message)) console.error('[zones] parcelles illisibles', error.message);
    return parZone;
  }
  for (const ligne of (data ?? []) as { zone_id: string; parcelle_ids: unknown }[]) {
    if (!Array.isArray(ligne.parcelle_ids)) continue;
    const ids = ligne.parcelle_ids.filter((id): id is string => typeof id === 'string' && id !== '');
    if (ids.length > 0) parZone.set(ligne.zone_id, ids);
  }
  return parZone;
}

/** La couleur de chaque collaborateur de l'agence (colonne posée le 26/10/2026). */
async function lireCouleursMembres(supabase: Client, agencyIds: readonly string[]): Promise<Map<string, string>> {
  const couleurs = new Map<string, string>();
  if (agencyIds.length === 0) return couleurs;
  const { data, error } = await (supabase as unknown as ClientLibre)
    .from('profile_agencies')
    .select('profile_id, agency_id, couleur')
    .in('agency_id', [...agencyIds]);
  if (error) return couleurs;
  for (const ligne of (data ?? []) as { profile_id: string; agency_id: string; couleur: unknown }[]) {
    if (typeof ligne.couleur === 'string' && /^#[0-9a-f]{6}$/i.test(ligne.couleur)) {
      couleurs.set(`${ligne.agency_id}:${ligne.profile_id}`, ligne.couleur);
    }
  }
  return couleurs;
}

/**
 * Toutes les zones de l'agence active, règles incluses, triées par nom.
 *
 * L'ordre est stable et fait foi : à spécificité égale, `zoneDeLAdresse`
 * retient la première zone de la liste. Un tri qui change d'un rendu à
 * l'autre ferait sauter un lead d'un secteur à un autre sans raison.
 */
async function lireZones(supabase: Client, agencyId?: string): Promise<Zone[]> {
  const lister = async (colonnes: string) => {
    let q = supabase.from('zones').select(colonnes);
    if (agencyId) q = q.eq('agency_id', agencyId);
    return q.order('nom');
  };

  // L'enveloppe n'existe qu'après la migration du 26/10/2026 ; avant, et le
  // temps que la migration des jours multiples passe, l'écran doit afficher
  // les secteurs plutôt que tomber sur une colonne absente.
  let zonesRes = await lister(`${ZONES_SELECT}, enveloppe`);
  if (zonesRes.error && /enveloppe/.test(zonesRes.error.message)) zonesRes = await lister(ZONES_SELECT);
  if (zonesRes.error && /jours_semaine/.test(zonesRes.error.message)) {
    zonesRes = await lister(ZONES_SELECT_JOUR_UNIQUE);
  }
  if (zonesRes.error) throw new Error(zonesRes.error.message);

  const rows = (zonesRes.data ?? []) as unknown as (ZoneRow & { enveloppe?: unknown })[];
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);

  const [reglesRes, parcelles, couleurs] = await Promise.all([
    supabase.from('zone_regles').select(REGLES_SELECT).in('zone_id', ids).order('created_at'),
    lireParcellesDesZones(supabase, ids),
    lireCouleursMembres(supabase, [...new Set(rows.map((r) => r.agency_id))]),
  ]);
  if (reglesRes.error) throw new Error(reglesRes.error.message);

  const parZone = new Map<string, RegleZone[]>();
  for (const brute of (reglesRes.data ?? []) as unknown as ZoneRegleRow[]) {
    const regle = versRegle(brute);
    if (!regle) {
      console.error('[zones] règle ignorée, valeur illisible', brute.id, brute.type);
      continue;
    }
    const liste = parZone.get(regle.zoneId);
    if (liste) liste.push(regle);
    else parZone.set(regle.zoneId, [regle]);
  }

  return rows.map((row) => {
    const regles = parZone.get(row.id) ?? [];
    const siennes = parcelles.get(row.id);
    const avecParcelles: RegleZone[] = siennes
      ? [...regles, { id: `parcelles:${row.id}`, zoneId: row.id, inclusion: true, type: 'parcelles', valeur: { parcelle_ids: siennes } }]
      : regles;
    const couleur = row.assigned_to ? (couleurs.get(`${row.agency_id}:${row.assigned_to}`) ?? null) : null;
    return versZone(row, avecParcelles, couleur);
  });
}

export async function fetchZones(supabase: Client): Promise<Zone[]> {
  return lireZones(supabase);
}

/**
 * Même lecture, filtrée par agence. Obligatoire dès que le client contourne
 * le RLS (service role des crons).
 */
export async function fetchZonesPourAgence(supabase: Client, agencyId: string): Promise<Zone[]> {
  return lireZones(supabase, agencyId);
}

/**
 * Version tolérante pour les écrans qui doivent s'afficher même sans zones :
 * tant que la migration n'est pas passée, l'accueil et la prospection
 * fonctionnent exactement comme avant.
 */
export async function fetchZonesSafe(supabase: Client): Promise<Zone[]> {
  try {
    return await fetchZones(supabase);
  } catch (err) {
    console.error('[zones] lecture impossible, écran sans secteurs', err);
    return [];
  }
}

/**
 * Le strict nécessaire pour décider d'un droit d'écriture sur une zone.
 *
 * Tant que `verrouillee` n'existe pas en base, on relit sans la colonne :
 * sinon la requête échoue et l'API répond « secteur introuvable » à un
 * négociateur dont le secteur existe très bien.
 */
export async function fetchZonePourDroit(
  supabase: Client,
  params: { zoneId: string; agencyId: string },
): Promise<{ assignedTo: string | null; verrouillee: boolean } | null> {
  const lire = (colonnes: string) =>
    supabase
      .from('zones')
      .select(colonnes)
      .eq('id', params.zoneId)
      .eq('agency_id', params.agencyId)
      .maybeSingle();

  const premier = await lire('id, assigned_to, verrouillee');
  const res =
    premier.error && /verrouillee/.test(premier.error.message)
      ? await lire('id, assigned_to')
      : premier;

  if (res.error) {
    console.error('[zones] lecture du secteur impossible', res.error.message);
    return null;
  }
  const row = res.data as unknown as
    | { assigned_to: string | null; verrouillee?: boolean }
    | null;
  if (!row) return null;
  return { assignedTo: row.assigned_to, verrouillee: row.verrouillee === true };
}

/** La zone du titulaire pour un jour donné (1 = lundi), s'il en a une. */
export function zoneDuJour(zones: readonly Zone[], profileId: string, jour: number): Zone | null {
  return (
    zones.find((z) => z.actif && z.assignedTo === profileId && z.joursSemaine.includes(jour)) ??
    null
  );
}

/**
 * Les jours que d'autres secteurs du même titulaire revendiquent déjà.
 *
 * Un index unique tenait cette règle tant qu'un secteur n'avait qu'un jour.
 * Avec un tableau, elle se contrôle ici : deux secteurs du même négociateur le
 * même mardi rendraient « la zone du jour » indécidable, et c'est l'ordre de
 * tri qui trancherait — un tri n'est pas une règle métier.
 */
export async function joursEnConflit(
  supabase: Client,
  params: {
    agencyId: string;
    assignedTo: string | null;
    jours: readonly number[];
    saufZoneId: string | null;
  },
): Promise<number[]> {
  if (!params.assignedTo || params.jours.length === 0) return [];

  const { data, error } = await supabase
    .from('zones')
    .select('id, jours_semaine')
    .eq('agency_id', params.agencyId)
    .eq('assigned_to', params.assignedTo)
    .eq('actif', true);
  if (error || !data) return [];

  const pris = new Set<number>();
  for (const row of data as unknown as { id: string; jours_semaine: number[] | null }[]) {
    if (row.id === params.saufZoneId) continue;
    for (const jour of row.jours_semaine ?? []) pris.add(jour);
  }
  return params.jours.filter((jour) => pris.has(jour));
}

/** Les zones d'un titulaire, tous jours confondus. Un collaborateur peut en avoir plusieurs. */
export function zonesDuTitulaire(zones: readonly Zone[], profileId: string): Zone[] {
  return zones.filter((z) => z.actif && z.assignedTo === profileId);
}
