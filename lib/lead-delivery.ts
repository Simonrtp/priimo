import type { Lead } from '@/types/lead';
import { sortProspects, type ProspectsSortMode } from '@/lib/lead-dpe';

export interface DeliveryBatchGroup {
  deliveredAt: string;
  label: string;
  leads: Lead[];
}

export interface PartitionedLeads {
  latestDeliveredAt: string | null;
  newBatch: Lead[];
  previousTotal: number;
  previousGroups: DeliveryBatchGroup[];
}

function parseInstant(iso: string): number {
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : Number.NEGATIVE_INFINITY;
}

/** Date ISO `YYYY-MM-DD` du lot le plus récent. */
export function getLatestDeliveredAt(leads: Pick<Lead, 'deliveredAt'>[]): string | null {
  let max: string | null = null;
  for (const l of leads) {
    if (!l.deliveredAt) continue;
    if (!max || l.deliveredAt > max) max = l.deliveredAt;
  }
  return max;
}

export function getMaxCreatedAt(leads: Pick<Lead, 'createdAt'>[]): string | null {
  let max: string | null = null;
  let maxTs = Number.NEGATIVE_INFINITY;
  for (const l of leads) {
    const ts = parseInstant(l.createdAt);
    if (ts > maxTs) {
      maxTs = ts;
      max = l.createdAt;
    }
  }
  return max;
}

/** Bandeau : lot inséré après la dernière visite (première visite → false). */
export function shouldShowPipelineBanner(
  allLeads: Pick<Lead, 'createdAt'>[],
  leadsLastSeenAt: string | null,
): boolean {
  return countLeadsCreatedAfter(allLeads, leadsLastSeenAt) > 0;
}

/** Leads apparus après la dernière fermeture du bandeau. */
export function countLeadsCreatedAfter(
  allLeads: Pick<Lead, 'createdAt'>[],
  leadsLastSeenAt: string | null,
): number {
  if (leadsLastSeenAt === null) return 0;
  const after = parseInstant(leadsLastSeenAt);
  return allLeads.filter((l) => parseInstant(l.createdAt) > after).length;
}

/** Nombre de leads du dernier lot (date de livraison max). */
export function countLatestBatchLeads(allLeads: Pick<Lead, 'deliveredAt'>[]): number {
  const latest = getLatestDeliveredAt(allLeads);
  if (!latest) return 0;
  return allLeads.filter((l) => l.deliveredAt === latest).length;
}

/** Clé de lot pour ne pas réafficher un bandeau déjà fermé (cache RSC). */
export function pipelineBannerBatchKey(allLeads: Pick<Lead, 'createdAt'>[]): string | null {
  return getMaxCreatedAt(allLeads);
}

/** Texte du bandeau Liste — rien d’autre. */
export function texteNouveauxLeads(n: number): string {
  if (n === 1) {
    return '1 nouveau lead dans 1 nouvelle annonce détectée sur votre secteur';
  }
  return `${n} nouveaux leads dans ${n} nouvelles annonces détectées sur votre secteur`;
}

/** Libellé sous-groupe : « Livrés le 30 mai 2026 ». */
export function formatDeliveryBatchLabel(deliveredAt: string): string {
  const d = new Date(`${deliveredAt}T12:00:00`);
  if (Number.isNaN(d.getTime())) return 'Livrés';
  const now = new Date();
  const formatted = new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' as const } : {}),
  }).format(d);
  return `Livrés le ${formatted}`;
}

/**
 * Découpe la liste filtrée : nouveaux (dernier lot) en haut, précédents groupés par date.
 * Le tri score/DPE s'applique à chaque sous-liste.
 */
export function partitionLeadsForDisplay(
  filteredLeads: Lead[],
  allLeads: Lead[],
  sortMode: ProspectsSortMode,
): PartitionedLeads {
  const latestDeliveredAt = getLatestDeliveredAt(allLeads);

  if (!latestDeliveredAt) {
    return {
      latestDeliveredAt: null,
      newBatch: sortProspects(filteredLeads, sortMode),
      previousTotal: 0,
      previousGroups: [],
    };
  }

  const newBatchRaw = filteredLeads.filter((l) => l.deliveredAt === latestDeliveredAt);
  const previousRaw = filteredLeads.filter((l) => l.deliveredAt !== latestDeliveredAt);

  const byDate = new Map<string, Lead[]>();
  for (const l of previousRaw) {
    const date = l.deliveredAt ?? '';
    if (!date) continue;
    const bucket = byDate.get(date);
    if (bucket) bucket.push(l);
    else byDate.set(date, [l]);
  }

  const previousGroups: DeliveryBatchGroup[] = [...byDate.keys()]
    .sort((a, b) => b.localeCompare(a))
    .map((deliveredAt) => ({
      deliveredAt,
      label: formatDeliveryBatchLabel(deliveredAt),
      leads: sortProspects(byDate.get(deliveredAt) ?? [], sortMode),
    }))
    .filter((g) => g.leads.length > 0);

  const previousTotal = previousGroups.reduce((n, g) => n + g.leads.length, 0);

  return {
    latestDeliveredAt,
    newBatch: sortProspects(newBatchRaw, sortMode),
    previousTotal,
    previousGroups,
  };
}
