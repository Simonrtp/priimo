import { parseDpeLetter } from '@/lib/carte/dpe-public';
import {
  dpeMatchesSelectedAges,
  isFreshMapDpe,
  type DpeAgeBucket,
} from '@/lib/carte/dpe-age';
import type { CadastreImmeublePoint } from '@/lib/carte/parcelle';

export type OverlayBuilding = {
  banId: string;
  parcelleId: string | null;
  longitude: number;
  latitude: number;
  adresse: string | null;
};

export type OverlayActivity = {
  banId: string;
  nbTransactions: number;
  derniereTransactionLe: string | null;
  prixM2: number | null;
  dernierPrix: number | null;
  nbDpe: number;
  dernierDpeLe: string | null;
  etiquetteDpe: string | null;
  nbPassoires: number;
  nbLots: number | null;
  procedureCopro: boolean;
};

export type OverlayDpeRow = {
  banId: string;
  dateDpe: string | null;
  etiquetteDpe: string | null;
  surface: number | null;
  etage: number | null;
};

function latestMatchingDpe(
  rows: readonly OverlayDpeRow[],
  ages: readonly DpeAgeBucket[],
  now: Date,
): OverlayDpeRow | null {
  let best: OverlayDpeRow | null = null;
  let bestT = -Infinity;
  for (const row of rows) {
    if (!dpeMatchesSelectedAges(row.dateDpe, ages, now)) continue;
    const t = row.dateDpe ? Date.parse(row.dateDpe) : NaN;
    if (!Number.isFinite(t) || t < bestT) continue;
    bestT = t;
    best = row;
  }
  return best;
}

/**
 * Un point par BAN. Diagnostics < 6 mois : grain adresse (détail).
 * Au-delà : agrégat building_activity, ou détail 6–12 mois hors agrégat.
 */
export function mergeCadastreImmeubles(args: {
  buildings: readonly OverlayBuilding[];
  activity: readonly OverlayActivity[];
  dpeRows: readonly OverlayDpeRow[];
  ages: readonly DpeAgeBucket[];
  now?: Date;
}): CadastreImmeublePoint[] {
  const now = args.now ?? new Date();
  const activityByBan = new Map(args.activity.map((a) => [a.banId, a]));
  const dpeByBan = new Map<string, OverlayDpeRow[]>();
  for (const row of args.dpeRows) {
    const list = dpeByBan.get(row.banId);
    if (list) list.push(row);
    else dpeByBan.set(row.banId, [row]);
  }

  const immeubles: CadastreImmeublePoint[] = [];
  const seen = new Set<string>();
  for (const b of args.buildings) {
    if (seen.has(b.banId)) continue;
    seen.add(b.banId);
    if (!Number.isFinite(b.longitude) || !Number.isFinite(b.latitude)) continue;
    const a = activityByBan.get(b.banId);
    const matching = latestMatchingDpe(dpeByBan.get(b.banId) ?? [], args.ages, now);
    const letterFromDetail = matching ? parseDpeLetter(matching.etiquetteDpe) : null;
    const letterFromActivity =
      a && dpeMatchesSelectedAges(a.dernierDpeLe, args.ages, now)
        ? parseDpeLetter(a.etiquetteDpe)
        : null;

    let dpeGrain: CadastreImmeublePoint['dpeGrain'] = null;
    let etiquetteDpe: string | null = null;
    let dateDpe: string | null = null;
    let surfaceDpe: number | null = null;
    let etageDpe: number | null = null;

    if (matching && letterFromDetail) {
      dpeGrain = isFreshMapDpe(matching.dateDpe, now) ? 'adresse' : 'immeuble';
      etiquetteDpe = letterFromDetail;
      dateDpe = matching.dateDpe;
      surfaceDpe = matching.surface;
      etageDpe = matching.etage;
    } else if (letterFromActivity) {
      dpeGrain = 'immeuble';
      etiquetteDpe = letterFromActivity;
      dateDpe = a?.dernierDpeLe ?? null;
    }

    immeubles.push({
      banId: b.banId,
      parcelleId: b.parcelleId,
      longitude: b.longitude,
      latitude: b.latitude,
      adresse: b.adresse,
      etiquetteDpe,
      dpeGrain,
      dateDpe,
      surfaceDpe,
      etageDpe,
      nbDpe: a?.nbDpe ?? (matching ? 1 : 0),
      nbPassoires: a?.nbPassoires ?? 0,
      nbTransactions: a?.nbTransactions ?? 0,
      dernierPrix: a?.dernierPrix ?? null,
      derniereTransactionLe: a?.derniereTransactionLe ?? null,
      prixM2: a?.prixM2 ?? null,
      nbLots: a?.nbLots ?? null,
      procedureCopro: Boolean(a?.procedureCopro),
    });
  }
  return immeubles;
}

export function formatPrixM2Court(value: number | null | undefined): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  return `${new Intl.NumberFormat('fr-FR').format(Math.round(value))} €/m²`;
}

export function medianNumerique(values: readonly number[]): number | null {
  const v = values.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (v.length === 0) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 === 1 ? v[mid]! : Math.round((v[mid - 1]! + v[mid]!) / 2);
}

export type VenteParcelleAgg = {
  parcelleId: string;
  adresse: string | null;
  nbTransactions: number;
  prixM2: number | null;
  dernierPrix: number | null;
  derniereTransactionLe: string | null;
};

/** Une ligne par parcelle : le cadastre des ventes, pas le point immeuble. */
export function ventesParParcelle(
  rows: readonly CadastreImmeublePoint[],
): Map<string, VenteParcelleAgg> {
  const out = new Map<string, VenteParcelleAgg>();
  const prix = new Map<string, number[]>();
  for (const row of rows) {
    const id = row.parcelleId;
    if (!id || row.nbTransactions <= 0) continue;
    const liste = prix.get(id) ?? [];
    if (row.prixM2 != null) liste.push(row.prixM2);
    prix.set(id, liste);
    const prev = out.get(id);
    if (!prev) {
      out.set(id, {
        parcelleId: id,
        adresse: row.adresse,
        nbTransactions: row.nbTransactions,
        prixM2: row.prixM2,
        dernierPrix: row.dernierPrix,
        derniereTransactionLe: row.derniereTransactionLe,
      });
      continue;
    }
    prev.nbTransactions += row.nbTransactions;
    if (!prev.adresse && row.adresse) prev.adresse = row.adresse;
    const t = row.derniereTransactionLe ? Date.parse(row.derniereTransactionLe) : NaN;
    const pt = prev.derniereTransactionLe ? Date.parse(prev.derniereTransactionLe) : NaN;
    if (Number.isFinite(t) && (!Number.isFinite(pt) || t > pt)) {
      prev.derniereTransactionLe = row.derniereTransactionLe;
      prev.dernierPrix = row.dernierPrix;
    }
  }
  for (const [id, agg] of out) {
    agg.prixM2 = medianNumerique(prix.get(id) ?? []);
  }
  return out;
}

export function overlayRowsFromAdeme(
  rows: readonly {
    identifiantBan?: string | null;
    dateEtablissement: string;
    lettre: string | null;
    surfaceM2: number | null;
    etage?: number | null;
  }[],
  banIds: ReadonlySet<string>,
): OverlayDpeRow[] {
  const out: OverlayDpeRow[] = [];
  for (const row of rows) {
    const banId = row.identifiantBan?.trim();
    if (!banId || !banIds.has(banId) || !row.dateEtablissement) continue;
    out.push({
      banId,
      dateDpe: row.dateEtablissement,
      etiquetteDpe: row.lettre,
      surface: row.surfaceM2,
      etage: row.etage ?? null,
    });
  }
  return out;
}

/** Point DPE affiché pour la plage du curseur. */
export function dpeVisibleOnMap(
  row: {
    dpeGrain: CadastreImmeublePoint['dpeGrain'];
    etiquetteDpe: string | null;
    dateDpe: string | null;
  },
  ages: readonly DpeAgeBucket[],
  now: Date = new Date(),
): boolean {
  if (!row.dpeGrain || !parseDpeLetter(row.etiquetteDpe)) return false;
  return dpeMatchesSelectedAges(row.dateDpe, ages, now);
}

/** Point à dessiner : DPE, vente ou copro — indépendant des polygones PCI. */
export function hasCadastreOverlay(row: {
  dpeGrain: CadastreImmeublePoint['dpeGrain'];
  etiquetteDpe: string | null;
  nbTransactions: number;
  nbLots: number | null;
  procedureCopro: boolean;
}): boolean {
  if (row.dpeGrain && parseDpeLetter(row.etiquetteDpe)) return true;
  if (row.nbTransactions > 0) return true;
  return row.nbLots != null || row.procedureCopro;
}

/**
 * Parcelles d’appartements sans entrée au RNC (« pas de copropriété déclarée »).
 * Heuristique carte (pas de BDNB ici) : activité multi-logements
 * (plusieurs DPE / ventes, ou DPE avec étage) et aucun lot de copropriété.
 */
export function parcelleIdsProprietaireUnique(
  rows: readonly CadastreImmeublePoint[],
): string[] {
  const byParcelle = new Map<string, CadastreImmeublePoint[]>();
  for (const row of rows) {
    if (!row.parcelleId) continue;
    const list = byParcelle.get(row.parcelleId);
    if (list) list.push(row);
    else byParcelle.set(row.parcelleId, [row]);
  }
  const out: string[] = [];
  for (const [id, list] of byParcelle) {
    if (list.some((r) => r.nbLots != null || r.procedureCopro)) continue;
    const nbDpe = list.reduce((s, r) => s + r.nbDpe, 0);
    const nbTx = list.reduce((s, r) => s + r.nbTransactions, 0);
    const etage = list.some((r) => r.etageDpe != null);
    if (nbDpe >= 2 || nbTx >= 2 || (etage && (nbDpe >= 1 || nbTx >= 1))) {
      out.push(id);
    }
  }
  return out;
}

/** Une vente lue directement dans building_transactions (la source du volet de la parcelle). */
export type VenteBrute = {
  parcelleId: string;
  dateMutation: string | null;
  valeurFonciere: number | null;
  prixM2: number | null;
};

/** DVF porte quelques prix aberrants (cessions à l'euro, erreurs de surface). */
const PRIX_M2_CARTE_MIN = 500;
const PRIX_M2_CARTE_MAX = 40_000;

/** Les parcelles dont l'agrégat par adresse ne compte aucune vente : à relire dans les ventes brutes. */
export function parcellesSansVentesAgregees(immeubles: readonly CadastreImmeublePoint[]): string[] {
  const avecVentes = new Set<string>();
  const toutes = new Set<string>();
  for (const row of immeubles) {
    if (!row.parcelleId) continue;
    toutes.add(row.parcelleId);
    if (row.nbTransactions > 0) avecVentes.add(row.parcelleId);
  }
  return [...toutes].filter((id) => !avecVentes.has(id));
}

/**
 * L'agrégat building_activity ne couvre qu'une partie des adresses (les autres
 * n'ont aucune ligne) : la carte n'y voyait pas de vente là où le volet de la
 * parcelle, lui, les lit une à une. Pour chaque parcelle sans vente agrégée,
 * ses ventes brutes sont portées par sa première adresse (une seule, pour que
 * le total par parcelle ne soit pas compté plusieurs fois).
 */
export function completerVentesParcelles(
  immeubles: readonly CadastreImmeublePoint[],
  ventes: readonly VenteBrute[],
): CadastreImmeublePoint[] {
  if (ventes.length === 0) return [...immeubles];
  const parParcelle = new Map<string, VenteBrute[]>();
  for (const v of ventes) {
    const liste = parParcelle.get(v.parcelleId);
    if (liste) liste.push(v);
    else parParcelle.set(v.parcelleId, [v]);
  }
  const aCompleter = new Set(parcellesSansVentesAgregees(immeubles));
  const faites = new Set<string>();
  return immeubles.map((row) => {
    const id = row.parcelleId;
    if (!id || !aCompleter.has(id) || faites.has(id)) return row;
    const liste = parParcelle.get(id);
    if (!liste || liste.length === 0) return row;
    faites.add(id);
    const recente = [...liste].sort((a, b) => (b.dateMutation ?? '').localeCompare(a.dateMutation ?? ''))[0]!;
    const prix = medianNumerique(
      liste.map((v) => v.prixM2).filter((n): n is number => n != null && n >= PRIX_M2_CARTE_MIN && n <= PRIX_M2_CARTE_MAX),
    );
    return {
      ...row,
      nbTransactions: liste.length,
      derniereTransactionLe: recente.dateMutation,
      dernierPrix: recente.valeurFonciere,
      prixM2: prix,
    };
  });
}
