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
