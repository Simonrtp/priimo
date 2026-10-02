import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import {
  canSeeActivityOf,
  canSeeLeadRecord,
  canSeeOwnedRecord,
  type RecordViewer,
} from '@/lib/agency/visibility';
import { canSeeVoiceNote } from '@/lib/notes/visibility';
import { parseDpeLetter } from '@/lib/carte/dpe-public';
import {
  DEFAULT_DPE_AGE_BUCKETS,
  dpeDetailQueryRange,
  needsDpeDetailRows,
  toDateParam,
  type DpeAgeBucket,
} from '@/lib/carte/dpe-age';
import { mergeCadastreImmeubles, overlayRowsFromAdeme, medianNumerique, hasCadastreOverlay } from '@/lib/carte/cadastre-overlay';
import { fetchDpeSecteur } from '@/lib/geo/ademe';
import type { DpeRecent } from '@/lib/automations/veille-dpe';
import type { CadastreSourceDates } from '@/lib/carte/cadastre-freshness';
import { CADASTRE_OVERLAY_MIN_ZOOM, formatParcelleId } from '@/lib/carte/parcelle';
import type {
  ParcelleAdresse,
  ParcelleBienAgence,
  ParcelleContactAgence,
  ParcelleCopro,
  ParcelleEntreprise,
  ParcelleFiche,
  ParcelleLogement,
  ParcelleNoteMarker,
  ParcelleOverlay,
  ParcellePassage,
  ParcelleProspect,
  ParcelleVente,
} from '@/lib/carte/parcelle';
import { FENETRE_VENTES_ANS, typeDominant } from '@/lib/carte/parcelle-synthese';
import { adresseLisible } from '@/lib/carte/adresse-lisible';
import { parseDisplaySignals } from '@/lib/display-signals';
import { signauxEssentiels } from '@/lib/lead-apercu';
import { parseContactabilite, parseContactsImmeuble } from '@/lib/lead-contacts';
import { formatPhoneOrNull } from '@/lib/import/normalize';
import { fetchLeadStages } from '@/lib/queries/lead-stages';

type Db = SupabaseClient<Database>;

const IN_CHUNK = 200;
const MAP_POINT_CAP = 2500;
const DPE_PAGE = 1000;
const DPE_PAGE_CAP = 8000;

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
  dpeFrais: {
    table: 'building_dpe',
    columns: ['ban_id', 'date_dpe', 'etiquette_dpe', 'surface', 'etage'] as const,
    when: 'couche-frais',
  },
  /** Médiane €/m² de la commune, pour situer l'immeuble. */
  secteur: {
    table: 'building_transactions',
    columns: ['prix_m2'] as const,
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

async function selectByBanIds<T>(
  /** Client admin uniquement — tables open data / agrégats listés ci-dessous. */
  openDataDb: Db,
  table: 'building_dpe' | 'building_copro' | 'building_activity' | 'buildings',
  columns: string,
  banIds: readonly string[],
): Promise<T[]> {
  if (banIds.length === 0) return [];
  const chunks: string[][] = [];
  for (let i = 0; i < banIds.length; i += IN_CHUNK) {
    chunks.push(banIds.slice(i, i + IN_CHUNK) as string[]);
  }
  const rows: T[] = [];
  // Lots de 4 : assez rapide sans saturer PostgREST.
  for (let i = 0; i < chunks.length; i += 4) {
    const lot = chunks.slice(i, i + 4);
    const pages = await Promise.all(
      lot.map(async (chunk) => {
        const { data, error } = await openDataDb.from(table).select(columns).in('ban_id', chunk);
        if (error) {
          console.error(`[parcelle] ${table}`, error.message);
          return [] as T[];
        }
        return (data ?? []) as unknown as T[];
      }),
    );
    for (const page of pages) rows.push(...page);
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
 * - sessionDb (utilisateur) : leads, contacts, biens, passages, étapes — RLS
 *   + helpers lib/agency/visibility.ts.
 *
 * Les notes ne passent plus par ici : la liste du volet les lit elle-même
 * (/api/dashboard/notes), rattachées à la parcelle ou posées sur ses adresses.
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

  const [adressesRes, buildingsRes, txRes] = await Promise.all([
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
  ]);

  if (adressesRes.error) console.error('[parcelle] parcelle_adresses', adressesRes.error.message);
  if (buildingsRes.error) console.error('[parcelle] buildings', buildingsRes.error.message);
  if (txRes.error) console.error('[parcelle] building_transactions', txRes.error.message);

  const adresses = (adressesRes.data ?? []) as unknown as AdresseRow[];
  let buildings = (buildingsRes.data ?? []) as unknown as BuildingRow[];
  const txRows = (txRes.data ?? []) as unknown as TxRow[];

  const banFromAdresses = adresses.map((a) => a.ban_id).filter((id): id is string => Boolean(id));
  const missingBan = banFromAdresses.filter((id) => !buildings.some((b) => b.ban_id === id));
  // Complément d'adresses en parallèle du reste — ne bloque plus DPE / agence.
  const extraBuildingsP =
    missingBan.length > 0
      ? selectByBanIds<BuildingRow>(
          openDataDb,
          'buildings',
          cols(PARCELLE_READ_QUERIES.buildings.columns),
          missingBan,
        )
      : Promise.resolve([] as BuildingRow[]);

  const banIds = [...new Set([...buildings.map((b) => b.ban_id), ...banFromAdresses])];
  const codesConnus = [
    ...buildings.map((b) => b.code_postal),
    ...adresses.map((a) => (a as AdresseRow & { code_postal?: string }).code_postal),
  ];
  const inSector = inAgencySector(codesConnus, args.postalCodes);
  const horsSecteur = !inSector && codesConnus.some((c) => Boolean(c && /^\d{5}$/.test(c)));

  const ventes: ParcelleVente[] = inSector
    ? txRows.map((row) => ({
        date: row.date_mutation,
        prix: num(row.valeur_fonciere),
        surface: num(row.surface_reelle_bati),
        prixM2: num(row.prix_m2),
        typeLocal: row.type_local,
        nombrePieces: num(row.nombre_pieces),
        banId: row.ban_id,
      }))
    : [];

  // Trois familles de lectures restent : l'open data rattaché aux BAN, le
  // prix du secteur et les enregistrements de l'agence posés sur ces mêmes
  // BAN. Aucune ne lit le résultat d'une autre : elles partent ensemble.
  const bansAgence = banIds.slice(0, IN_CHUNK);
  // Le code commune ouvre toute référence cadastrale : il est toujours là,
  // quand le code postal manque à la plupart des ventes en base.
  const codeCommune = /^\d[\dAB]\d{3}/.test(parcelleId) ? parcelleId.slice(0, 5) : null;
  const typeVentes = typeDominant(ventes);

  const openDataParBan = inSector
    ? Promise.all([
        // Admin : building_dpe = diagnostics ADEME open data.
        selectByBanIds<DpeRow>(openDataDb, 'building_dpe', cols(PARCELLE_READ_QUERIES.dpe.columns), banIds),
        // Admin : building_copro = RNC open data.
        selectByBanIds<CoproRow>(openDataDb, 'building_copro', cols(PARCELLE_READ_QUERIES.copro.columns), banIds),
      ])
    : Promise.resolve([[], []] as [DpeRow[], CoproRow[]]);

  const secteurP =
    inSector && codeCommune && typeVentes
      ? prixM2DuSecteur(openDataDb, codeCommune, typeVentes)
      : Promise.resolve(null);

  const agenceP =
    bansAgence.length > 0
      ? lireAgenceSurLaParcelle(sessionDb, agencyId, bansAgence, viewer)
      : Promise.resolve(AGENCE_VIDE);

  const [[dpeRows, coproRows], prixM2Secteur, agence, extraBuildings] = await Promise.all([
    openDataParBan,
    secteurP,
    agenceP,
    extraBuildingsP,
  ]);
  if (extraBuildings.length > 0) {
    buildings = [...buildings, ...extraBuildings];
  }

  const logements: ParcelleLogement[] = dpeRows.map((row) => {
    const etage = num(row.etage);
    return {
      banId: row.ban_id,
      date: row.date_dpe,
      etiquette: parseDpeLetter(row.etiquette_dpe) ?? row.etiquette_dpe,
      etiquetteGes: parseDpeLetter(row.etiquette_ges),
      consoKwhM2: num(row.conso_kwh_m2_an),
      surface: num(row.surface),
      // L'étage 0 de l'ADEME est une valeur par défaut, pas un rez-de-chaussée.
      etage: etage != null && etage >= 1 ? etage : null,
    };
  });

  const seenCopro = new Set<string>();
  const coproprietes: ParcelleCopro[] = [];
  for (const row of coproRows) {
    const key = row.numero_immatriculation ?? row.ban_id;
    if (seenCopro.has(key)) continue;
    seenCopro.add(key);
    coproprietes.push(toCopro(row));
  }

  const adressesFiche: ParcelleAdresse[] = [];
  const vuesAdresses = new Set<string>();
  for (const b of buildings) {
    if (!b.adresse?.trim()) continue;
    const { voie } = adresseLisible(b.adresse);
    if (vuesAdresses.has(voie.toLowerCase())) continue;
    vuesAdresses.add(voie.toLowerCase());
    adressesFiche.push({ banId: b.ban_id, libelle: voie });
  }

  const adresseBrute = pickAdresse(buildings);
  const principal =
    buildings.find((b) => b.adresse?.trim() === adresseBrute && b.lat != null && b.lng != null) ??
    buildings.find((b) => b.lat != null && b.lng != null) ??
    buildings.find((b) => b.adresse?.trim() === adresseBrute) ??
    null;
  const lisible = adresseBrute
    ? adresseLisible(adresseBrute, { codePostal: principal?.code_postal, commune: principal?.commune })
    : null;

  const videPublic = ventes.length === 0 && logements.length === 0 && coproprietes.length === 0;

  return {
    parcelleId,
    reference: formatParcelleId(parcelleId),
    adresse: lisible?.voie ?? null,
    localite: lisible?.localite ?? null,
    banId: principal?.ban_id ?? null,
    adresses: adressesFiche,
    position:
      principal && principal.lat != null && principal.lng != null
        ? { latitude: principal.lat, longitude: principal.lng }
        : null,
    horsSecteur,
    videPublic,
    surfaceCadastreM2: null,
    nbAdresses: buildings.length,
    prixM2Secteur,
    ventes,
    logements,
    coproprietes,
    ...agence,
  };
}

type AgenceSurLaParcelle = Pick<
  ParcelleFiche,
  'prospects' | 'contacts' | 'biens' | 'entreprises' | 'passages'
>;

const AGENCE_VIDE: AgenceSurLaParcelle = {
  prospects: [],
  contacts: [],
  biens: [],
  entreprises: [],
  passages: [],
};

const LEAD_PARCELLE_COLUMNS =
  'id, address, score, assigned_to, ban_id, dpe_class, display_signals, owner_type, owner_company, company_name, contactabilite, contacts_immeuble, stage_id, etage, surface_m2, rooms';

type LeadParcelleRow = {
  id: string;
  address: string;
  score: number;
  assigned_to: string | null;
  dpe_class: string | null;
  display_signals: unknown;
  owner_type: string | null;
  owner_company: string | null;
  company_name: string | null;
  contactabilite: string | null;
  contacts_immeuble: unknown;
  stage_id: string | null;
  etage: number | null;
  surface_m2: number | null;
  rooms: number | null;
};

type ContactParcelleRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  contact_type: string | null;
  phone: string | null;
  assigned_to: string | null;
  created_by: string | null;
};

type BienParcelleRow = {
  id: string;
  address: string;
  mandat_statut: string | null;
  price: number | null;
  surface_m2: number | null;
  rooms: number | null;
  created_by: string | null;
};

type PassageRow = { day: string; kind: string; profile_id: string };

const KINDS_PASSAGE = ['rencontre', 'absent', 'passer'] as const;

/**
 * Ce que l'agence sait déjà de ces adresses. Chaque ligne repasse par les
 * helpers de visibilité, en plus de la RLS.
 */
async function lireAgenceSurLaParcelle(
  sessionDb: Db,
  agencyId: string,
  bans: readonly string[],
  viewer: RecordViewer,
): Promise<AgenceSurLaParcelle> {
  const [leadsRes, contactsRes, biensRes, passagesRes, stages] = await Promise.all([
    sessionDb
      .from('leads')
      .select(LEAD_PARCELLE_COLUMNS)
      .eq('agency_id', agencyId)
      .in('ban_id', [...bans])
      .order('score', { ascending: false }),
    sessionDb
      .from('contacts')
      .select('id, first_name, last_name, contact_type, phone, assigned_to, created_by, ban_id')
      .eq('agency_id', agencyId)
      .in('ban_id', [...bans]),
    sessionDb
      .from('biens')
      .select('id, address, mandat_statut, price, surface_m2, rooms, created_by, ban_id')
      .eq('agency_id', agencyId)
      .in('ban_id', [...bans]),
    sessionDb
      .from('sortie_events')
      .select('day, kind, profile_id')
      .eq('agency_id', agencyId)
      .in('ban_id', [...bans])
      .in('kind', [...KINDS_PASSAGE])
      .order('day', { ascending: false })
      .limit(20),
    fetchLeadStages(sessionDb).catch(() => []),
  ]);

  if (leadsRes.error) console.error('[parcelle] leads', leadsRes.error.message);
  if (passagesRes.error) console.error('[parcelle] passages', passagesRes.error.message);

  const etapes = new Map(stages.map((s) => [s.id, s.libelle]));
  const prospects: ParcelleProspect[] = [];
  const entreprises: ParcelleEntreprise[] = [];
  const numerosVus = new Set<string>();

  for (const row of (leadsRes.data ?? []) as unknown as LeadParcelleRow[]) {
    if (!canSeeLeadRecord(viewer, { assignedTo: row.assigned_to ?? null })) continue;
    const contactabilite = parseContactabilite(row.contactabilite);
    prospects.push({
      id: row.id,
      href: `/dashboard/prospection?lead=${row.id}`,
      adresse: adresseLisible(row.address).voie,
      score: row.score,
      dpe: parseDpeLetter(row.dpe_class),
      etage: num(row.etage),
      surface: num(row.surface_m2),
      pieces: num(row.rooms),
      // La lettre a sa pastille : on ne la répète pas dans les signaux.
      signaux: signauxEssentiels({ displaySignals: parseDisplaySignals(row.display_signals) }).filter(
        (s) => !/^DPE [A-G]$/i.test(s),
      ),
      entreprise:
        row.owner_type === 'entreprise'
          ? (row.owner_company ?? row.company_name ?? '').trim() || null
          : null,
      etape: row.stage_id ? etapes.get(row.stage_id) ?? null : null,
      contactabilite: contactabilite === 'aucun' ? null : contactabilite,
    });

    for (const contact of parseContactsImmeuble(row.contacts_immeuble)) {
      const numero = contact.phone.replace(/\D/g, '');
      if (!numero || numerosVus.has(numero)) continue;
      numerosVus.add(numero);
      entreprises.push({
        nom: contact.companyName,
        telephone: contact.phone,
        activite: contact.nafLibelle,
        categorie: contact.categorie,
        leadId: row.id,
      });
    }
  }

  const contacts: ParcelleContactAgence[] = [];
  for (const row of (contactsRes.data ?? []) as unknown as ContactParcelleRow[]) {
    if (!canSeeOwnedRecord(viewer, { assignedTo: row.assigned_to ?? null, createdBy: row.created_by ?? null })) {
      continue;
    }
    contacts.push({
      id: row.id,
      href: `/dashboard/contacts?fiche=${row.id}`,
      nom: [row.first_name, row.last_name].map((s) => (s ?? '').trim()).filter(Boolean).join(' ') || 'Contact',
      type: row.contact_type ?? null,
      telephone: formatPhoneOrNull(row.phone),
    });
  }

  const biens: ParcelleBienAgence[] = [];
  for (const row of (biensRes.data ?? []) as unknown as BienParcelleRow[]) {
    if (!canSeeOwnedRecord(viewer, { assignedTo: null, createdBy: row.created_by ?? null })) continue;
    biens.push({
      id: row.id,
      href: `/dashboard/biens?fiche=${row.id}`,
      adresse: adresseLisible(row.address).voie,
      statut: row.mandat_statut ?? null,
      prix: num(row.price),
      surface: num(row.surface_m2),
      pieces: num(row.rooms),
    });
  }

  // Un collaborateur ne voit que ses propres passages ; le directeur, toute l'équipe.
  const passagesVisibles = ((passagesRes.data ?? []) as unknown as PassageRow[])
    .filter((p) => canSeeActivityOf(viewer, p.profile_id))
    .filter((p): p is PassageRow & { kind: ParcellePassage['kind'] } =>
      (KINDS_PASSAGE as readonly string[]).includes(p.kind),
    )
    .slice(0, 5);
  const autres = [...new Set(passagesVisibles.map((p) => p.profile_id).filter((id) => id !== viewer.id))];
  const prenoms = new Map<string, string>();
  if (autres.length > 0) {
    const { data } = await sessionDb.from('profiles').select('id, first_name').in('id', autres);
    for (const p of (data ?? []) as { id: string; first_name: string | null }[]) {
      if (p.first_name?.trim()) prenoms.set(p.id, p.first_name.trim());
    }
  }
  const passages: ParcellePassage[] = passagesVisibles.map((p) => ({
    jour: p.day,
    kind: p.kind,
    auteur: p.profile_id === viewer.id ? null : prenoms.get(p.profile_id) ?? 'Un collègue',
  }));

  return { prospects, contacts, biens, entreprises, passages };
}

/**
 * Médiane €/m² de la commune (l'arrondissement à Paris, Lyon, Marseille) :
 * open data partagé entre agences, gardé douze heures.
 */
const PRIX_SECTEUR_TTL_MS = 12 * 60 * 60 * 1000;
const prixSecteurCache = new Map<string, { valeur: number | null; at: number }>();

async function prixM2DuSecteur(openDataDb: Db, codeCommune: string, typeLocal: string): Promise<number | null> {
  const cle = `${codeCommune}|${typeLocal}`;
  const connu = prixSecteurCache.get(cle);
  if (connu && Date.now() - connu.at < PRIX_SECTEUR_TTL_MS) return connu.valeur;

  const depuis = new Date();
  depuis.setFullYear(depuis.getFullYear() - FENETRE_VENTES_ANS);
  // Admin : building_transactions = DVF open data. Les mille ventes les plus
  // récentes de la commune suffisent à une médiane.
  const { data, error } = await openDataDb
    .from('building_transactions')
    .select(cols(PARCELLE_READ_QUERIES.secteur.columns))
    .like('parcelle_id', `${codeCommune}%`)
    .eq('type_local', typeLocal)
    .gte('date_mutation', toDateParam(depuis))
    .not('prix_m2', 'is', null)
    .order('date_mutation', { ascending: false })
    .limit(1000);
  if (error) {
    console.error('[parcelle] prix du secteur', error.message);
    return null;
  }
  const valeur = medianNumerique(
    ((data ?? []) as unknown as { prix_m2: unknown }[])
      .map((r) => num(r.prix_m2))
      .filter((n): n is number => n != null && n >= 500 && n <= 40_000),
  );
  prixSecteurCache.set(cle, { valeur, at: Date.now() });
  return valeur;
}

export type OverlayViewport = {
  west: number;
  south: number;
  east: number;
  north: number;
  zoom: number;
};

/**
 * Couche carte : buildings + building_activity (agrégat).
 * Les diagnostics de moins de 12 mois ne sont pas dans l'agrégat : on lit
 * building_dpe uniquement pour ces points, un par adresse.
 * Ventes et copro restent sur l'agrégat. Les notes passent par sessionDb.
 */
export async function fetchParcelleOverlays(args: {
  /** Admin — buildings + building_activity, et building_dpe si diagnostics frais. */
  publicDb: Db;
  /** Session — marqueurs notes agence. */
  agencyDb: Db;
  agencyId: string;
  postalCodes: readonly string[];
  viewer: RecordViewer;
  viewport: OverlayViewport | null;
  dpeAges?: readonly DpeAgeBucket[];
  includeDpeDetail?: boolean;
}): Promise<ParcelleOverlay> {
  const openDataDb = args.publicDb;
  const codes = args.postalCodes.filter((c) => /^\d{5}$/.test(c));
  const ages = args.dpeAges ?? DEFAULT_DPE_AGE_BUCKETS;
  const includeDpe = args.includeDpeDetail === true && needsDpeDetailRows(ages);
  const [notes, sources] = await Promise.all([
    fetchParcelleNoteMarkers(args.agencyDb, args.agencyId, args.viewer),
    fetchCadastreSourceDates(openDataDb, codes),
  ]);

  if (!args.viewport || args.viewport.zoom < CADASTRE_OVERLAY_MIN_ZOOM || codes.length === 0) {
    return { immeubles: [], notes, sources };
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
    return { immeubles: [], notes, sources };
  }

  const buildings = (data ?? []) as unknown as BuildingRow[];
  const banIds = buildings.map((b) => b.ban_id);

  // ADEME seulement sur les CP réellement présents dans le viewport (pas toute l'agence).
  const codesViewport = [
    ...new Set(
      buildings
        .map((b) => b.code_postal)
        .filter((c): c is string => typeof c === 'string' && /^\d{5}$/.test(c)),
    ),
  ];
  const ademeDepuis = includeDpe ? ademeLookbackDepuis(dpeDetailQueryRange(ages)?.from) : null;
  const ademePromise =
    ademeDepuis && codesViewport.length > 0
      ? fetchDpeSecteur(codesViewport, ademeDepuis, undefined, { taille: 4000, cached: true })
      : Promise.resolve([]);

  // Admin : building_activity = agrégat Priimo (pas de table ventes/copro de détail).
  const activityPromise = selectByBanIds<ActivityRow>(
    openDataDb,
    'building_activity',
    cols(PARCELLE_READ_QUERIES.activity.columns),
    banIds,
  );
  const dpePromise = loadDetailDpe(openDataDb, banIds, ages, includeDpe, ademePromise);

  const [activity, dpeRows] = await Promise.all([activityPromise, dpePromise]);

  const immeubles = mergeCadastreImmeubles({
    buildings: buildings.map((b) => ({
      banId: b.ban_id,
      parcelleId: b.parcelle_id,
      longitude: b.lng ?? 0,
      latitude: b.lat ?? 0,
      adresse: b.adresse,
    })),
    activity: activity.map((a) => ({
      banId: a.ban_id,
      nbTransactions: a.nb_transactions_total ?? 0,
      derniereTransactionLe: a.derniere_transaction_le,
      prixM2: num(a.prix_m2_median),
      dernierPrix: num(a.dernier_prix),
      nbDpe: a.nb_dpe_total ?? 0,
      dernierDpeLe: a.dernier_dpe_le,
      etiquetteDpe: a.etiquette_dpe ?? null,
      nbPassoires: a.nb_passoires ?? 0,
      nbLots: a.nb_lots ?? null,
      procedureCopro: Boolean(a.procedure_copro),
    })),
    dpeRows: dpeRows.map((row) => {
      const etage = num(row.etage);
      return {
        banId: row.ban_id,
        dateDpe: row.date_dpe,
        etiquetteDpe: row.etiquette_dpe,
        surface: num(row.surface),
        etage: etage != null && etage >= 1 ? etage : null,
      };
    }),
    ages,
  }).filter(hasCadastreOverlay);

  return { immeubles, notes, sources };
}

async function loadDetailDpe(
  openDataDb: Db,
  banIds: readonly string[],
  ages: readonly DpeAgeBucket[],
  include: boolean,
  ademePromise: Promise<DpeRecent[]>,
): Promise<DpeRow[]> {
  if (!include || banIds.length === 0) {
    await ademePromise.catch(() => []);
    return [];
  }
  const range = dpeDetailQueryRange(ages) ?? undefined;
  const [frais, ademe] = await Promise.all([selectDpeFrais(openDataDb, banIds, range), ademePromise]);
  if (ademe.length === 0) return frais;
  const extra = overlayRowsFromAdeme(ademe, new Set(banIds));
  if (extra.length === 0) return frais;
  return [
    ...frais,
    ...extra.map((row) => ({
      ban_id: row.banId,
      date_dpe: row.dateDpe,
      etiquette_dpe: row.etiquetteDpe,
      etiquette_ges: null,
      conso_kwh_m2_an: null,
      surface: row.surface,
      etage: row.etage,
      numero_dpe: null,
      source: 'ademe',
    })),
  ];
}

function ademeLookbackDepuis(rangeFrom: Date | undefined): string | null {
  if (!rangeFrom) return null;
  return toDateParam(rangeFrom);
}

async function selectDpeFrais(
  openDataDb: Db,
  banIds: readonly string[],
  range?: { from: Date; to: Date },
): Promise<DpeRow[]> {
  if (banIds.length === 0) return [];
  const columns = cols(PARCELLE_READ_QUERIES.dpeFrais.columns);
  const chunks: string[][] = [];
  for (let i = 0; i < banIds.length; i += IN_CHUNK) {
    chunks.push(banIds.slice(i, i + IN_CHUNK) as string[]);
  }

  async function lireChunk(chunk: string[]): Promise<DpeRow[]> {
    const rows: DpeRow[] = [];
    let from = 0;
    while (from < DPE_PAGE_CAP) {
      let query = openDataDb
        .from('building_dpe')
        .select(columns)
        .in('ban_id', chunk)
        .not('date_dpe', 'is', null)
        .order('date_dpe', { ascending: false });
      if (range) {
        query = query.gte('date_dpe', toDateParam(range.from)).lte('date_dpe', toDateParam(range.to));
      }
      const { data, error } = await query.range(from, from + DPE_PAGE - 1);
      if (error) {
        console.error('[parcelle] building_dpe frais', error.message);
        break;
      }
      const page = (data ?? []) as unknown as DpeRow[];
      rows.push(...page);
      if (page.length < DPE_PAGE) break;
      from += DPE_PAGE;
    }
    return rows;
  }

  const rows: DpeRow[] = [];
  for (let i = 0; i < chunks.length; i += 4) {
    const pages = await Promise.all(chunks.slice(i, i + 4).map(lireChunk));
    for (const page of pages) rows.push(...page);
  }
  return rows;
}

const SOURCE_DATES_TTL_MS = 5 * 60 * 1000;
const sourceDatesCache = new Map<string, { at: number; value: CadastreSourceDates }>();

async function fetchCadastreSourceDates(openDataDb: Db, codes: readonly string[]): Promise<CadastreSourceDates> {
  if (codes.length === 0) return { diagnosticsAt: null, ventesAt: null };
  const cle = [...codes].sort().join(',');
  const hit = sourceDatesCache.get(cle);
  if (hit && Date.now() - hit.at < SOURCE_DATES_TTL_MS) return hit.value;

  const dpeQuery = openDataDb
    .from('building_dpe')
    .select('created_at')
    .in('code_postal', codes)
    .order('created_at', { ascending: false })
    .limit(1);
  const ventesQuery = openDataDb
    .from('building_activity')
    .select('derniere_transaction_le')
    .in('code_postal', codes)
    .not('derniere_transaction_le', 'is', null)
    .order('derniere_transaction_le', { ascending: false })
    .limit(1);
  const [dpeRes, ventesRes] = await Promise.all([dpeQuery, ventesQuery]);
  if (dpeRes.error) console.error('[parcelle] fraîcheur DPE', dpeRes.error.message);
  if (ventesRes.error) console.error('[parcelle] fraîcheur ventes', ventesRes.error.message);
  const dpeRow = (dpeRes.data ?? [])[0] as { created_at?: string } | undefined;
  const venteRow = (ventesRes.data ?? [])[0] as { derniere_transaction_le?: string | null } | undefined;
  const value: CadastreSourceDates = {
    diagnosticsAt: dpeRow?.created_at ?? null,
    ventesAt: venteRow?.derniere_transaction_le ?? null,
  };
  sourceDatesCache.set(cle, { at: Date.now(), value });
  return value;
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
