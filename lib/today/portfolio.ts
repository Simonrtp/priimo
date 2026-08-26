/**
 * États de portefeuille pour le bandeau Accueil.
 * Uniquement des données que Priimo observe sans saisie d'agent.
 */

export const PORTFOLIO_STALE_MANDAT_DAYS = 60;
export const PORTFOLIO_STALE_VISIT_MAX = 3;
export const PORTFOLIO_RDV_SANS_SUITE_DAYS = 7;

const DAY_MS = 86_400_000;

export type PortfolioCounterKind =
  | 'mandats-actifs'
  | 'leads-non-pris'
  | 'estimations'
  | 'mandats-60j';

export type PortfolioCounter = {
  kind: PortfolioCounterKind;
  value: number;
  label: string;
  subtitle: string | null;
  href: string;
};

export type PortfolioStats = {
  counters: readonly PortfolioCounter[];
};

function ageDays(iso: string | null | undefined, now: number): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return (now - t) / DAY_MS;
}

export function isSignedMandat(statut: string): boolean {
  return statut === 'mandat_simple' || statut === 'mandat_exclusif';
}

export function buildPortfolioStats(input: {
  biens: readonly {
    id: string;
    mandatStatut: string;
    mandatDate: string | null;
    createdAt: string;
  }[];
  visitCountByBienId: Readonly<Record<string, number>>;
  leads: readonly { stageId: string | null }[];
  estimationStageId: string | null;
  rendezVousSansSuite: number;
  now?: number;
}): PortfolioStats {
  const now = input.now ?? Date.now();
  const signed = input.biens.filter((b) => isSignedMandat(b.mandatStatut));
  const exclusifs = signed.filter((b) => b.mandatStatut === 'mandat_exclusif').length;
  const nonPris = input.leads.filter((l) => l.stageId == null).length;

  let estimations: { value: number; subtitle: string; href: string };
  if (input.estimationStageId) {
    const n = input.leads.filter((l) => l.stageId === input.estimationStageId).length;
    estimations = {
      value: n,
      subtitle: 'Dans le pipeline',
      href: '/dashboard/prospection?filtre=estimations',
    };
  } else {
    estimations = {
      value: input.rendezVousSansSuite,
      subtitle: 'RDV sans suite depuis 7 j',
      href: '/dashboard/contacts?filtre=rdv-sans-suite',
    };
  }

  const stale = signed.filter((b) => {
    const age = ageDays(b.mandatDate ?? b.createdAt, now);
    if (age === null || age <= PORTFOLIO_STALE_MANDAT_DAYS) return false;
    const visits = input.visitCountByBienId[b.id] ?? 0;
    return visits < PORTFOLIO_STALE_VISIT_MAX;
  }).length;

  return {
    counters: [
      {
        kind: 'mandats-actifs',
        value: signed.length,
        label: 'Mandats actifs',
        subtitle: exclusifs > 0 ? `${exclusifs} exclusif${exclusifs > 1 ? 's' : ''}` : 'Dont 0 exclusif',
        href: '/dashboard/biens?filtre=mandats-actifs',
      },
      {
        kind: 'leads-non-pris',
        value: nonPris,
        label: 'Leads non pris',
        subtitle: 'Livrés, pas encore au kanban',
        href: '/dashboard/prospection?filtre=non-pris',
      },
      {
        kind: 'estimations',
        value: estimations.value,
        label: 'Estimations',
        subtitle: estimations.subtitle,
        href: estimations.href,
      },
      {
        kind: 'mandats-60j',
        value: stale,
        label: 'Mandats qui pourrissent',
        subtitle: 'Plus de 60 j, moins de 3 visites',
        href: '/dashboard/biens?filtre=mandats-60j',
      },
    ],
  };
}

export function countRendezVousSansSuite(
  rdv: readonly { contactId: string | null; fin: string }[],
  lastInteractionByContactId: Readonly<Record<string, string | null>>,
  now = Date.now(),
): number {
  const cutoff = now - PORTFOLIO_RDV_SANS_SUITE_DAYS * DAY_MS;
  const seen = new Set<string>();
  let n = 0;
  for (const row of rdv) {
    const fin = Date.parse(row.fin);
    if (!Number.isFinite(fin) || fin > cutoff) continue;
    const key = row.contactId ?? `rdv:${fin}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (row.contactId) {
      const last = lastInteractionByContactId[row.contactId];
      if (last) {
        const t = Date.parse(last);
        if (Number.isFinite(t) && t > fin) continue;
      }
    }
    n += 1;
  }
  return n;
}
