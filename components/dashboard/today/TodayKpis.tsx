'use client';

import type { LucideIcon } from 'lucide-react';
import { Building2, Inbox, MapPin, Phone, Sparkles, Target, TriangleAlert, Users } from 'lucide-react';
import type { TodayCard, TodayCardType } from '@/lib/today/cards';
import type { TodayPortfolioSnapshot } from '@/lib/today/stats';
import ClayCard from '@/components/ui/ClayCard';

export type TodayKpiFilter = TodayCardType | 'tous';

interface KpiTile {
  key: string;
  label: string;
  value: string;
  hint: string | null;
  Icon: LucideIcon;
  tint: string;
  /** Filtre la pile d'actions, ou navigation externe si pas de pile. */
  filter?: TodayKpiFilter;
  href?: string;
}

function countByType(cards: readonly TodayCard[], type: TodayCardType): number {
  return cards.filter((c) => c.type === type).length;
}

function buildWorkKpis(cards: readonly TodayCard[]): KpiTile[] {
  const total = cards.length;
  const relances = countByType(cards, 'relance');
  const rapprochements = countByType(cards, 'rapprochement');
  const adresses = countByType(cards, 'nouvelle_adresse');
  const transmis = countByType(cards, 'transmis');
  const alertes = countByType(cards, 'alerte');
  const enRetard = cards.filter((c) => c.type === 'relance' && c.urgent).length;
  const acquereurs = cards
    .filter((c) => c.type === 'rapprochement')
    .reduce((sum, c) => sum + (c.matches?.length ?? 0), 0);

  return [
    ...(alertes > 0
      ? [
          {
            key: 'alerte',
            label: 'Urgent',
            value: alertes.toLocaleString('fr-FR'),
            hint: "signalé par l'équipe",
            Icon: TriangleAlert,
            tint: 'bg-red-50 text-red-600',
            filter: 'alerte' as TodayKpiFilter,
          },
        ]
      : []),
    ...(transmis > 0
      ? [
          {
            key: 'transmis',
            label: 'Transmis',
            value: transmis.toLocaleString('fr-FR'),
            hint: 'à reprendre',
            Icon: Inbox,
            tint: 'bg-sky-50 text-sky-700',
            filter: 'transmis' as TodayKpiFilter,
          },
        ]
      : []),
    {
      key: 'total',
      label: 'À traiter',
      value: total.toLocaleString('fr-FR'),
      hint: total > 0 ? 'actions du jour' : null,
      Icon: Target,
      tint: 'bg-primary-50 text-primary-600',
      filter: 'tous',
    },
    {
      key: 'relance',
      label: 'Relances',
      value: relances.toLocaleString('fr-FR'),
      hint:
        enRetard > 0
          ? `${enRetard} en retard`
          : relances > 0
            ? 'personnes à rappeler'
            : null,
      Icon: Phone,
      tint: 'bg-amber-50 text-amber-600',
      filter: 'relance',
    },
    {
      key: 'rapprochement',
      label: 'Rapprochements',
      value: rapprochements.toLocaleString('fr-FR'),
      hint: acquereurs > 0 ? `${acquereurs} acquéreur${acquereurs > 1 ? 's' : ''}` : null,
      Icon: Users,
      tint: 'bg-violet-50 text-violet-600',
      filter: 'rapprochement',
    },
    {
      key: 'adresse',
      label: 'Nouvelles adresses',
      value: adresses.toLocaleString('fr-FR'),
      hint: adresses > 0 ? 'à travailler' : null,
      Icon: MapPin,
      tint: 'bg-emerald-50 text-emerald-600',
      filter: 'nouvelle_adresse',
    },
  ];
}

function buildPortfolioKpis(portfolio: TodayPortfolioSnapshot): KpiTile[] {
  return [
    {
      key: 'total',
      label: 'À traiter',
      value: '0',
      hint: 'vous êtes à jour',
      Icon: Target,
      tint: 'bg-primary-50 text-primary-600',
    },
    {
      key: 'contacts',
      label: 'Contacts',
      value: portfolio.contactCount.toLocaleString('fr-FR'),
      hint:
        portfolio.acquereurCount > 0
          ? `${portfolio.acquereurCount} acquéreur${portfolio.acquereurCount > 1 ? 's' : ''}`
          : 'personnes suivies',
      Icon: Users,
      tint: 'bg-violet-50 text-violet-600',
      href: '/dashboard/contacts',
    },
    {
      key: 'biens',
      label: 'Biens',
      value: portfolio.bienCount.toLocaleString('fr-FR'),
      hint: 'en portefeuille',
      Icon: Building2,
      tint: 'bg-emerald-50 text-emerald-600',
      href: '/dashboard/biens',
    },
    {
      key: 'prospection',
      label: 'Adresses détectées',
      value: portfolio.leadsNonTraites.toLocaleString('fr-FR'),
      hint:
        portfolio.newBatchCount > 0
          ? `${portfolio.newBatchCount} cette semaine`
          : 'non travaillées',
      Icon: Sparkles,
      tint: 'bg-amber-50 text-amber-600',
      href: '/dashboard/prospection',
    },
  ];
}

export default function TodayKpis({
  cards,
  portfolio,
  active,
  onFilter,
}: {
  cards: readonly TodayCard[];
  portfolio: TodayPortfolioSnapshot;
  active: TodayKpiFilter;
  onFilter: (filter: TodayKpiFilter) => void;
}) {
  const tiles = cards.length > 0 ? buildWorkKpis(cards) : buildPortfolioKpis(portfolio);

  return (
    <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4 xl:gap-4">
      {tiles.map(({ key, label, value, hint, Icon, tint, filter, href }) => {
        const selected = filter !== undefined && active === filter;
        const clickable = Boolean(filter) || Boolean(href);

        const inner = (
          <ClayCard
            padding="md"
            className={`h-full transition-[box-shadow,background-color] duration-fluid-subtle ease-in-out ${
              selected
                ? 'bg-soft-warm/50 shadow-clay-lg'
                : clickable
                  ? 'hover:shadow-clay-lg'
                  : ''
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="line-clamp-2 text-[11px] font-semibold uppercase tracking-wider text-text-subtle">
                  {label}
                </p>
                <p className="mt-2 font-display text-[1.75rem] font-bold leading-none tabular-nums text-primary-500 sm:text-[2rem] xl:text-4xl">
                  {value}
                </p>
                {hint ? (
                  <p className="mt-2 truncate text-[12px] text-text-muted sm:text-[12.5px]">{hint}</p>
                ) : (
                  <p className="mt-2 select-none text-[12px] text-transparent sm:text-[12.5px]" aria-hidden>
                    —
                  </p>
                )}
              </div>
              <div
                className={`grid h-9 w-9 flex-shrink-0 place-items-center rounded-xl sm:h-10 sm:w-10 ${tint}`}
              >
                <Icon className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
              </div>
            </div>
          </ClayCard>
        );

        if (href) {
          return (
            <a
              key={key}
              href={href}
              className="block text-inherit no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
            >
              {inner}
            </a>
          );
        }

        if (filter) {
          const count = filter === 'tous' ? cards.length : countByType(cards, filter);
          return (
            <button
              key={key}
              type="button"
              disabled={cards.length === 0 || (filter !== 'tous' && count === 0)}
              aria-pressed={selected}
              onClick={() => onFilter(selected ? 'tous' : filter)}
              className="block w-full text-left disabled:cursor-default disabled:opacity-70"
            >
              {inner}
            </button>
          );
        }

        return <div key={key}>{inner}</div>;
      })}
    </div>
  );
}
