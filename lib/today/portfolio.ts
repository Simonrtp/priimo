/**
 * États de portefeuille pour le bandeau Accueil.
 * Uniquement des données que Priimo observe sans saisie d'agent.
 */

import {
  formatWeekDelta,
  leadsNonPrisTone,
  mandats60jTone,
  mandatsActifsTone,
  rdvSansSuiteTone,
  type CounterTone,
} from '@/lib/today/counter-severity';

export const PORTFOLIO_STALE_MANDAT_DAYS = 60;
export const PORTFOLIO_STALE_VISIT_MAX = 3;
export const PORTFOLIO_RDV_SANS_SUITE_DAYS = 7;

const DAY_MS = 86_400_000;

export type PortfolioCounterKind =
  | 'mandats-actifs'
  | 'leads-non-pris'
  | 'rdv-sans-suite'
  | 'estimations'
  | 'mandats-60j';

export type PortfolioCounter = {
  kind: PortfolioCounterKind;
  value: number;
  label: string;
  subtitle: string | null;
  href: string;
  subtitleHref: string | null;
  previousValue: number | null;
  deltaLabel: string | null;
  tone: CounterTone;
};

export type PortfolioStats = {
  counters: readonly PortfolioCounter[];
};

export type PortfolioPreviousWeek = {
  mandatsActifs: number;
  leadsNonPris: number;
  rdvSansSuite: number;
  mandats60j: number;
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

function withDelta(value: number, previous: number | null): Pick<PortfolioCounter, 'previousValue' | 'deltaLabel'> {
  return {
    previousValue: previous,
    deltaLabel: formatWeekDelta(value, previous),
  };
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
  previousWeek?: PortfolioPreviousWeek | null;
  now?: number;
}): PortfolioStats {
  const now = input.now ?? Date.now();
  const prev = input.previousWeek ?? null;
  const signed = input.biens.filter((b) => isSignedMandat(b.mandatStatut));
  const exclusifs = signed.filter((b) => b.mandatStatut === 'mandat_exclusif').length;
  const delivered = input.leads.length;
  const nonPris = input.leads.filter((l) => l.stageId == null).length;

  let third: {
    kind: 'estimations' | 'rdv-sans-suite';
    value: number;
    label: string;
    subtitle: string;
    href: string;
    tone: CounterTone;
  };
  if (input.estimationStageId) {
    const n = input.leads.filter((l) => l.stageId === input.estimationStageId).length;
    third = {
      kind: 'estimations',
      value: n,
      label: 'Estimations',
      subtitle: 'Dans le pipeline',
      href: '/dashboard/prospection?filtre=estimations&vue=liste',
      tone: rdvSansSuiteTone(n),
    };
  } else {
    third = {
      kind: 'rdv-sans-suite',
      value: input.rendezVousSansSuite,
      label: 'Rendez-vous sans suite',
      subtitle: 'Terminés depuis plus de 7 j, sans échange après',
      href: '/dashboard/contacts?filtre=rdv-sans-suite',
      tone: rdvSansSuiteTone(input.rendezVousSansSuite),
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
        subtitleHref: '/dashboard/biens?filtre=mandats-exclusifs',
        tone: mandatsActifsTone(signed.length),
        ...withDelta(signed.length, prev?.mandatsActifs ?? null),
      },
      {
        kind: 'leads-non-pris',
        value: nonPris,
        label: 'Leads non pris',
        subtitle: 'Livrés, pas encore au kanban',
        href: '/dashboard/prospection?filtre=non-pris&vue=liste',
        subtitleHref: null,
        tone: leadsNonPrisTone(nonPris, delivered),
        ...withDelta(nonPris, prev?.leadsNonPris ?? null),
      },
      {
        kind: third.kind,
        value: third.value,
        label: third.label,
        subtitle: third.subtitle,
        href: third.href,
        subtitleHref: null,
        tone: third.tone,
        ...withDelta(third.value, prev?.rdvSansSuite ?? null),
      },
      {
        kind: 'mandats-60j',
        value: stale,
        label: 'Mandats qui pourrissent',
        subtitle: 'Plus de 60 j, moins de 3 visites',
        href: '/dashboard/biens?filtre=mandats-60j',
        subtitleHref: null,
        tone: mandats60jTone(stale),
        ...withDelta(stale, prev?.mandats60j ?? null),
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
