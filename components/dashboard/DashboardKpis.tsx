import type { LucideIcon } from 'lucide-react';
import { Flame, Sparkles, TrendingUp, Users } from 'lucide-react';
import type { Lead } from '@/types/lead';
import ClayCard from '@/components/ui/ClayCard';

interface DashboardKpisProps {
  /** Portefeuille complet de l'agence (non filtré) — vue « dashboard agence ». */
  leads: Lead[];
  /** Nombre de leads du dernier run (nouveaux cette semaine). */
  newBatchCount: number;
}

interface Kpi {
  key: string;
  label: string;
  value: string;
  Icon: LucideIcon;
  /** Chip d'icône discret : fond teinté clair + icône ligne (bg + text color). */
  tint: string;
}

/**
 * Rangée de cartes KPI du dashboard agence — PRIIMO_DESIGN_SYSTEM.md §9.1.
 * Cartes clay, valeur en text-4xl avec dégradé de marque, label eyebrow
 * au-dessus, chip d'icône coloré en coin. Données réelles (aucun mock).
 */
export default function DashboardKpis({ leads, newBatchCount }: DashboardKpisProps) {
  const total = leads.length;
  const avgScore = total > 0 ? Math.round(leads.reduce((sum, l) => sum + l.score, 0) / total) : null;
  const hotCount = leads.filter((l) => l.score >= 80).length;

  const kpis: Kpi[] = [
    {
      key: 'total',
      label: 'Prospects',
      value: total.toLocaleString('fr-FR'),
      Icon: Users,
      tint: 'bg-primary-50 text-primary-600',
    },
    {
      key: 'avg',
      label: 'Score moyen',
      value: avgScore != null ? String(avgScore) : '—',
      Icon: TrendingUp,
      tint: 'bg-violet-50 text-violet-600',
    },
    {
      key: 'hot',
      label: 'Leads chauds',
      value: hotCount.toLocaleString('fr-FR'),
      Icon: Flame,
      tint: 'bg-emerald-50 text-emerald-600',
    },
    {
      key: 'new',
      label: 'Nouveaux cette semaine',
      value: newBatchCount.toLocaleString('fr-FR'),
      Icon: Sparkles,
      tint: 'bg-amber-50 text-amber-600',
    },
  ];

  return (
    <div className="app-snap -mx-4 mb-4 flex gap-3 overflow-x-auto px-4 md:mx-0 md:grid md:grid-cols-4 md:gap-4 md:overflow-visible md:px-0">
      {kpis.map(({ key, label, value, Icon, tint }) => (
        <ClayCard
          key={key}
          padding="md"
          className="animate-clay-pop w-[42%] shrink-0 snap-start max-md:border max-md:border-black/[0.06] max-md:shadow-none md:w-auto"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="line-clamp-2 text-[11px] font-semibold uppercase tracking-wider text-text-subtle">
                {label}
              </p>
              <p className="mt-2 font-display text-[2rem] font-bold leading-none tabular-nums text-primary-500 md:text-4xl">
                {value}
              </p>
            </div>
            <div
              className={`grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl ${tint}`}
            >
              <Icon className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
            </div>
          </div>
        </ClayCard>
      ))}
    </div>
  );
}
