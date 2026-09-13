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

function versZone(row: ZoneRow, regles: readonly RegleZone[]): Zone {
  return {
    id: row.id,
    agencyId: row.agency_id,
    nom: row.nom,
    couleur: row.couleur,
    assignedTo: row.assigned_to,
    joursSemaine: joursDeLaLigne(row),
    actif: row.actif,
    verrouillee: row.verrouillee === true,
    regles,
  };
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

  const premier = await lister(ZONES_SELECT);
  // Le temps que la migration des jours multiples passe, l'écran doit afficher
  // les secteurs plutôt que tomber sur une colonne absente.
  const zonesRes =
    premier.error && /jours_semaine/.test(premier.error.message)
      ? await lister(ZONES_SELECT_JOUR_UNIQUE)
      : premier;
  if (zonesRes.error) throw new Error(zonesRes.error.message);

  const rows = (zonesRes.data ?? []) as unknown as ZoneRow[];
  if (rows.length === 0) return [];

  const reglesRes = await supabase
    .from('zone_regles')
    .select(REGLES_SELECT)
    .in(
      'zone_id',
      rows.map((r) => r.id),
    )
    .order('created_at');
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

  return rows.map((row) => versZone(row, parZone.get(row.id) ?? []));
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

/** Les zones d'un titulaire, tous jours confondus. */
export function zonesDuTitulaire(zones: readonly Zone[], profileId: string): Zone[] {
  return zones.filter((z) => z.actif && z.assignedTo === profileId);
}
