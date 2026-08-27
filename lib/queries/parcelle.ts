import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import {
  canSeeLeadRecord,
  canSeeOwnedRecord,
  type RecordViewer,
} from '@/lib/agency/visibility';
import { canSeeVoiceNote } from '@/lib/notes/visibility';
import { filterPublicDiagnostics, parseDpeLetter } from '@/lib/carte/dpe-public';
import { CADASTRE_OVERLAY_MIN_ZOOM, formatParcelleId } from '@/lib/carte/parcelle';
import type {
  CadastreImmeublePoint,
  ParcelleAgencyItem,
  ParcelleCopro,
  ParcelleFiche,
  ParcelleNoteMarker,
  ParcelleOverlay,
} from '@/lib/carte/parcelle';

type Db = SupabaseClient<Database>;

const IN_CHUNK = 200;
const MAP_POINT_CAP = 2500;

/**
 * Colonnes réellement lues — à tenir alignées sur le schéma live.
 * Aucune requête de ce module ne cible parcelle_ventes, parcelle_diagnostics, ni une colonne idu.
 */
export const PARCELLE_READ_QUERIES = {
  adresses: {
    table: 'parcelle_adresses',
    columns: ['parcelle_id', 'ban_id', 'source', 'created_at'] as const,
    when: 'fiche',
  },
  buildings: {
    table: 'buildings',
    columns: ['ban_id', 'parcelle_id', 'adresse', 'code_postal', 'commune', 'lat', 'lng'] as const,
    when: 'fiche+couche',
  },
  transactions: {
    table: 'building_transactions',
    columns: [
      'parcelle_id',
      'ban_id',
      'date_mutation',
      'valeur_fonciere',
      'surface_reelle_bati',
      'prix_m2',
      'type_local',
      'nombre_pieces',
    ] as const,
    when: 'fiche',
  },
  dpe: {
    table: 'building_dpe',
    columns: [
      'ban_id',
      'date_dpe',
      'etiquette_dpe',
      'etiquette_ges',
      'conso_kwh_m2_an',
      'surface',
      'etage',
      'numero_dpe',
      'source',
    ] as const,
    when: 'fiche',
  },
  copro: {
    table: 'building_copro',
    columns: [
      'ban_id',
      'numero_immatriculation',
      'nombre_lots',
      'periode_construction',
      'procedure_en_cours',
      'date_maj',
      'source',
    ] as const,
    when: 'fiche',
  },
  activity: {
    table: 'building_activity',
    columns: [
      'ban_id',
      'nb_transactions_total',
      'derniere_transaction_le',
      'prix_m2_median',
      'dernier_prix',
      'nb_dpe_total',
      'dernier_dpe_le',
      'etiquette_dpe',
      'nb_passoires',
      'nb_lots',
      'procedure_copro',
    ] as const,
    when: 'couche',
  },
} as const;

function cols(list: readonly string[]): string {
  return list.join(', ');
}

function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim()) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function inAgencySector(cps: readonly (string | null | undefined)[], agencyCodes: readonly string[]): boolean {
  const allowed = new Set(agencyCodes.filter((c) => /^\d{5}$/.test(c)));
  if (allowed.size === 0) return false;
  const known = cps.filter((c): c is string => Boolean(c && /^\d{5}$/.test(c)));
  if (known.length === 0) return false;
  return known.some((c) => allowed.has(c));
}

export function formatPeriodeConstruction(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const map: Record<string, string> = {
    AVANT_1949: 'Avant 1949',
    DE_1949_A_1960: '1949–1960',
    DE_1961_A_1974: '1961–1974',
    DE_1975_A_1993: '1975–1993',
    DE_1994_A_2000: '1994–2000',
    DE_2001_A_2010: '2001–2010',
    APRES_2010: 'Après 2010',
  };
  return map[raw] ?? raw.replace(/_/g, ' ').toLowerCase();
}

function excerpt(text: string | null): string | null {
  const t = (text ?? '').trim().replace(/\s+/g, ' ');
  if (!t) return null;
  return t.length > 90 ? `${t.slice(0, 89)}…` : t;
}

async function selectByBanIds<T>(
  /** Client admin uniquement — tables open data / agrégats listés ci-dessous. */
  openDataDb: Db,
  table: 'building_dpe' | 'building_copro' | 'building_activity' | 'buildings',
  columns: string,
  banIds: readonly string[],
): Promise<T[]> {
  if (banIds.length === 0) return [];
  const rows: T[] = [];
  for (let i = 0; i < banIds.length; i += IN_CHUNK) {
    const chunk = banIds.slice(i, i + IN_CHUNK);
    // Admin légitime : lecture batch open data / agrégat (pas de table agence).
    const { data, error } = await openDataDb.from(table).select(columns).in('ban_id', chunk);
    if (error) {
      console.error(`[parcelle] ${table}`, error.message);
      continue;
    }
    rows.push(...((data ?? []) as unknown as T[]));
  }
  return rows;
}

type AdresseRow = { parcelle_id: string; ban_id: string | null; source: string | null; created_at: string };
type BuildingRow = {
  ban_id: string;
  parcelle_id: string | null;
  adresse: string | null;
  code_postal: string | null;
  commune: string | null;
  lat: number | null;
  lng: number | null;
};
type TxRow = {
  parcelle_id: string | null;
  ban_id: string | null;
  date_mutation: string;
  valeur_fonciere: number | null;
  surface_reelle_bati: number | null;
  prix_m2: number | null;
  type_local: string | null;
  nombre_pieces: number | null;
};
type DpeRow = {
  ban_id: string;
  date_dpe: string | null;
  etiquette_dpe: string | null;
  etiquette_ges: string | null;
  conso_kwh_m2_an: number | null;
  surface: number | null;
  etage: number | null;
  numero_dpe: string | null;
  source: string | null;
};
type CoproRow = {
  ban_id: string;
  numero_immatriculation: string | null;
  nombre_lots: number | null;
  periode_construction: string | null;
  procedure_en_cours: boolean | null;
  date_maj: string | null;
  source: string | null;
};
type ActivityRow = {
  ban_id: string;
  nb_transactions_total: number | null;
  derniere_transaction_le: string | null;
  prix_m2_median: number | null;
  dernier_prix?: number | null;
  nb_dpe_total: number | null;
  dernier_dpe_le: string | null;
  etiquette_dpe?: string | null;
  nb_passoires: number | null;
  nb_lots: number | null;
  procedure_copro: boolean | null;
  code_postal?: string | null;
};

function pickAdresse(buildings: BuildingRow[]): string | null {
  const withLabel = buildings.find((b) => (b.adresse ?? '').trim());
  return withLabel?.adresse?.trim() || null;
}

function toCopro(row: CoproRow): ParcelleCopro {
  return {
    lots: row.nombre_lots,
    periodeConstruction: formatPeriodeConstruction(row.periode_construction),
    procedureEnCours: Boolean(row.procedure_en_cours),
    numeroImmatriculation: row.numero_immatriculation,
  };
}

/**
 * Fiche parcelle.
 *
 * Deux clients, jamais mélangés :
 * - openDataDb (service_role) : UNIQUEMENT buildings, building_transactions,
 *   building_dpe, building_copro, building_activity, parcelle_adresses.
 * - sessionDb (utilisateur) : leads, contacts, biens, notes — RLS + helpers
 *   lib/agency/visibility.ts (et canSeeVoiceNote).
 */
export async function fetchParcelleFiche(args: {
  /** Admin — open data / agrégats Priimo uniquement. */
  publicDb: Db;
  /** Session — données agence, filtrées par visibility. */
  agencyDb: Db;
  parcelleId: string;
  agencyId: string;
  postalCodes: readonly string[];
  viewer: RecordViewer;
}): Promise<ParcelleFiche> {
  const openDataDb = args.publicDb;
  const sessionDb = args.agencyDb;
  const { parcelleId, agencyId, viewer } = args;

  const [adressesRes, buildingsRes, txRes, liensRes] = await Promise.all([
    // Admin : parcelle_adresses = index BAN↔parcelle (open data), pas de PII agence.
    openDataDb
      .from('parcelle_adresses')
      .select(cols(PARCELLE_READ_QUERIES.adresses.columns))
      .eq('parcelle_id', parcelleId),
    // Admin : buildings = référentiel BAN public.
    openDataDb
      .from('buildings')
      .select(cols(PARCELLE_READ_QUERIES.buildings.columns))
      .eq('parcelle_id', parcelleId),
    // Admin : building_transactions = DVF open data.
    openDataDb
      .from('building_transactions')
      .select(cols(PARCELLE_READ_QUERIES.transactions.columns))
      .eq('parcelle_id', parcelleId)
      .order('date_mutation', { ascending: false }),
    // Session : liens notes↔parcelle — isolés par agency_id + RLS.
    sessionDb
      .from('note_liens')
      .select('note_id')
      .eq('agency_id', agencyId)
      .eq('entite_type', 'parcelle')
      .eq('entite_id', parcelleId),
  ]);

  if (adressesRes.error) console.error('[parcelle] parcelle_adresses', adressesRes.error.message);
  if (buildingsRes.error) console.error('[parcelle] buildings', buildingsRes.error.message);
  if (txRes.error) console.error('[parcelle] building_transactions', txRes.error.message);

  const adresses = (adressesRes.data ?? []) as unknown as AdresseRow[];
  let buildings = (buildingsRes.data ?? []) as unknown as BuildingRow[];
  const txRows = (txRes.data ?? []) as unknown as TxRow[];
  const noteIdsFromLiens = (liensRes.data ?? []).map((r) => r.note_id);

  const banFromAdresses = adresses.map((a) => a.ban_id).filter((id): id is string => Boolean(id));
  const missingBan = banFromAdresses.filter((id) => !buildings.some((b) => b.ban_id === id));
  if (missingBan.length > 0) {
    // Admin : complément buildings par ban_id (toujours open data).
    const extra = await selectByBanIds<BuildingRow>(
      openDataDb,
      'buildings',
      cols(PARCELLE_READ_QUERIES.buildings.columns),
      missingBan,
    );
    buildings = [...buildings, ...extra];
  }

  const banIds = [...new Set([...buildings.map((b) => b.ban_id), ...banFromAdresses])];
  const inSector = inAgencySector(
    [...buildings.map((b) => b.code_postal), ...adresses.map((a) => (a as AdresseRow & { code_postal?: string }).code_postal)],
    args.postalCodes,
  );

  const [dpeRows, coproRows] = inSector
    ? await Promise.all([
        // Admin : building_dpe = diagnostics ADEME open data.
        selectByBanIds<DpeRow>(openDataDb, 'building_dpe', cols(PARCELLE_READ_QUERIES.dpe.columns), banIds),
        // Admin : building_copro = RNC open data.
        selectByBanIds<CoproRow>(openDataDb, 'building_copro', cols(PARCELLE_READ_QUERIES.copro.columns), banIds),
      ])
    : [[], []];

  const diagnostics = inSector
    ? filterPublicDiagnostics(
        dpeRows.map((row) => ({
          date: row.date_dpe,
          etiquette: parseDpeLetter(row.etiquette_dpe) ?? row.etiquette_dpe,
          type: 'DPE',
        })),
      )
    : [];

  const ventes = inSector
    ? txRows.map((row) => ({
        date: row.date_mutation,
        prix: num(row.valeur_fonciere),
        surface: num(row.surface_reelle_bati),
        prixM2: num(row.prix_m2),
        typeLocal: row.type_local,
      }))
    : [];

  const seenCopro = new Set<string>();
  const coproprietes: ParcelleCopro[] = [];
  if (inSector) {
    for (const row of coproRows) {
      const key = row.numero_immatriculation ?? row.ban_id;
      if (seenCopro.has(key)) continue;
      seenCopro.add(key);
      coproprietes.push(toCopro(row));
    }
  }

  const surCetteParcelle: ParcelleAgencyItem[] = [];
  const seen = new Set<string>();
  function push(item: ParcelleAgencyItem) {
    const key = `${item.kind}:${item.id}`;
    if (seen.has(key)) return;
    seen.add(key);
    surCetteParcelle.push(item);
  }

  // --- Données agence : sessionDb uniquement + helpers visibility ---
  if (banIds.length > 0) {
    const [leadsRes, contactsRes, biensRes, notesBanRes] = await Promise.all([
      sessionDb
        .from('leads')
        .select('id, address, city, postal_code, score, assigned_to, ban_id')
        .eq('agency_id', agencyId)
        .in('ban_id', banIds.slice(0, IN_CHUNK)),
      sessionDb
        .from('contacts')
        .select('id, first_name, last_name, contact_type, assigned_to, created_by, ban_id')
        .eq('agency_id', agencyId)
        .in('ban_id', banIds.slice(0, IN_CHUNK)),
      sessionDb
        .from('biens')
        .select('id, address, mandat_statut, created_by, ban_id')
        .eq('agency_id', agencyId)
        .in('ban_id', banIds.slice(0, IN_CHUNK)),
      sessionDb
        .from('voice_notes')
        .select('id, transcript, visibilite, created_by, assigned_to, ban_id')
        .eq('agency_id', agencyId)
        .in('ban_id', banIds.slice(0, IN_CHUNK)),
    ]);

    for (const row of leadsRes.data ?? []) {
      if (!canSeeLeadRecord(viewer, { assignedTo: row.assigned_to ?? null })) continue;
      push({
        id: row.id,
        kind: 'lead',
        title: row.address,
        subtitle: [row.postal_code, row.city].filter(Boolean).join(' ') || null,
        href: `/dashboard/prospection?lead=${row.id}`,
      });
    }
    for (const row of contactsRes.data ?? []) {
      if (!canSeeOwnedRecord(viewer, { assignedTo: row.assigned_to ?? null, createdBy: row.created_by ?? null })) continue;
      const title = [row.first_name, row.last_name].map((s) => (s ?? '').trim()).filter(Boolean).join(' ') || 'Contact';
      push({
        id: row.id,
        kind: 'contact',
        title,
        subtitle: row.contact_type ?? null,
        href: `/dashboard/contacts?fiche=${row.id}`,
      });
    }
    for (const row of biensRes.data ?? []) {
      if (!canSeeOwnedRecord(viewer, { assignedTo: null, createdBy: row.created_by ?? null })) continue;
      push({
        id: row.id,
        kind: 'bien',
        title: row.address,
        subtitle: row.mandat_statut ?? null,
        href: `/dashboard/biens?fiche=${row.id}`,
      });
    }
    for (const row of notesBanRes.data ?? []) {
      if (!canSeeVoiceNote(viewer, { visibilite: row.visibilite === 'privee' ? 'privee' : 'agence', createdBy: row.created_by ?? null })) {
        continue;
      }
      push({
        id: row.id,
        kind: 'note',
        title: excerpt(row.transcript) ?? 'Note terrain',
        subtitle: null,
        href: '/dashboard',
      });
    }
  }

  if (noteIdsFromLiens.length > 0) {
    const { data: linkedNotes } = await sessionDb
      .from('voice_notes')
      .select('id, transcript, visibilite, created_by')
      .eq('agency_id', agencyId)
      .in('id', noteIdsFromLiens);
    for (const row of linkedNotes ?? []) {
      if (!canSeeVoiceNote(viewer, { visibilite: row.visibilite === 'privee' ? 'privee' : 'agence', createdBy: row.created_by ?? null })) {
        continue;
      }
      push({
        id: row.id,
        kind: 'note',
        title: excerpt(row.transcript) ?? 'Note terrain',
        subtitle: null,
        href: '/dashboard',
      });
    }
  }

  const videPublic = ventes.length === 0 && diagnostics.length === 0 && coproprietes.length === 0;

  return {
    parcelleId,
    reference: formatParcelleId(parcelleId),
    adresse: pickAdresse(buildings),
    videPublic,
    ventes,
    diagnostics,
    coproprietes,
    surCetteParcelle,
  };
}

export type OverlayViewport = {
  west: number;
  south: number;
  east: number;
  north: number;
  zoom: number;
};

/**
 * Couche carte : buildings + building_activity uniquement (open data / agrégat).
 * Les notes parcelle passent par sessionDb + canSeeVoiceNote.
 */
export async function fetchParcelleOverlays(args: {
  /** Admin — buildings + building_activity uniquement. */
  publicDb: Db;
  /** Session — marqueurs notes agence. */
  agencyDb: Db;
  agencyId: string;
  postalCodes: readonly string[];
  viewer: RecordViewer;
  viewport: OverlayViewport | null;
}): Promise<ParcelleOverlay> {
  const openDataDb = args.publicDb;
  const codes = args.postalCodes.filter((c) => /^\d{5}$/.test(c));
  const notes = await fetchParcelleNoteMarkers(args.agencyDb, args.agencyId, args.viewer);

  if (!args.viewport || args.viewport.zoom < CADASTRE_OVERLAY_MIN_ZOOM || codes.length === 0) {
    return { immeubles: [], notes };
  }

  const { west, south, east, north } = args.viewport;
  // Admin : buildings filtré au secteur agence (open data géolocalisé).
  const { data, error } = await openDataDb
    .from('buildings')
    .select(cols(PARCELLE_READ_QUERIES.buildings.columns))
    .in('code_postal', codes)
    .gte('lat', south)
    .lte('lat', north)
    .gte('lng', west)
    .lte('lng', east)
    .not('lat', 'is', null)
    .not('lng', 'is', null)
    .limit(MAP_POINT_CAP);

  if (error) {
    console.error('[parcelle] overlay buildings', error.message);
    return { immeubles: [], notes };
  }

  const buildings = (data ?? []) as unknown as BuildingRow[];
  const banIds = buildings.map((b) => b.ban_id);
  // Admin : building_activity = agrégat Priimo (pas de table leads/contacts).
  const activity = await selectByBanIds<ActivityRow>(
    openDataDb,
    'building_activity',
    cols(PARCELLE_READ_QUERIES.activity.columns),
    banIds,
  );
  const activityByBan = new Map(activity.map((a) => [a.ban_id, a]));

  const immeubles: CadastreImmeublePoint[] = [];
  const seenBan = new Set<string>();
  for (const b of buildings) {
    if (seenBan.has(b.ban_id)) continue;
    seenBan.add(b.ban_id);
    if (b.lat == null || b.lng == null) continue;
    const a = activityByBan.get(b.ban_id);
    const etiquette = parseDpeLetter(a?.etiquette_dpe ?? null);
    immeubles.push({
      banId: b.ban_id,
      parcelleId: b.parcelle_id,
      longitude: b.lng,
      latitude: b.lat,
      adresse: b.adresse,
      etiquetteDpe: etiquette,
      nbDpe: a?.nb_dpe_total ?? 0,
      nbPassoires: a?.nb_passoires ?? 0,
      nbTransactions: a?.nb_transactions_total ?? 0,
      dernierPrix: num(a?.dernier_prix),
      prixM2: num(a?.prix_m2_median),
      nbLots: a?.nb_lots ?? null,
      procedureCopro: Boolean(a?.procedure_copro),
    });
  }

  return { immeubles, notes };
}

/** Notes liées à une parcelle — sessionDb + canSeeVoiceNote uniquement. */
async function fetchParcelleNoteMarkers(
  sessionDb: Db,
  agencyId: string,
  viewer: RecordViewer,
): Promise<ParcelleNoteMarker[]> {
  const { data: liens } = await sessionDb
    .from('note_liens')
    .select('note_id, entite_id')
    .eq('agency_id', agencyId)
    .eq('entite_type', 'parcelle');

  const noteIds = [...new Set((liens ?? []).map((l) => l.note_id))];
  const parcelleByNote = new Map((liens ?? []).map((l) => [l.note_id, l.entite_id]));
  const notes: ParcelleNoteMarker[] = [];
  const seen = new Set<string>();

  if (noteIds.length === 0) return notes;

  const { data: rows } = await sessionDb
    .from('voice_notes')
    .select('id, latitude, longitude, visibilite, created_by')
    .eq('agency_id', agencyId)
    .in('id', noteIds.slice(0, IN_CHUNK));

  for (const row of rows ?? []) {
    if (
      !canSeeVoiceNote(viewer, {
        visibilite: row.visibilite === 'privee' ? 'privee' : 'agence',
        createdBy: row.created_by ?? null,
      })
    ) {
      continue;
    }
    const parcelleId = parcelleByNote.get(row.id);
    if (!parcelleId || seen.has(parcelleId)) continue;
    seen.add(parcelleId);
    notes.push({
      parcelleId,
      latitude: row.latitude ?? null,
      longitude: row.longitude ?? null,
    });
  }

  return notes;
}
