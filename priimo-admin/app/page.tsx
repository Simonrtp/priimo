import Link from 'next/link';
import { Building2, MapPin, Gauge, Sparkles } from 'lucide-react';
import { KpiCard } from '@/components/KpiCard';
import { Panel, PageHeader } from '@/components/Panel';
import { Badge } from '@/components/Badge';
import { LeadsAreaChart } from '@/components/charts/LeadsAreaChart';
import { MlFeedbackDonut } from '@/components/charts/MlFeedbackDonut';
import { fetchDashboardStats, fetchLeadsPerDay, fetchRecentAgencies } from '@/lib/queries/admin';
import {
  ML_FEEDBACK_COLORS,
  ML_FEEDBACK_LABELS,
  PLAN_LABELS,
  formatDate,
  formatNumber,
  formatPercent,
} from '@/lib/utils/format';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ML_ORDER = ['mandat_signe', 'vendeur_perdu', 'pas_vendeur', 'injoignable', 'aucun'] as const;

export default async function DashboardPage() {
  const [stats, leadsPerDay, recentAgencies] = await Promise.all([
    fetchDashboardStats(),
    fetchLeadsPerDay(30),
    fetchRecentAgencies(5),
  ]);

  const donutData = ML_ORDER.map((key) => ({
    key,
    name: key === 'aucun' ? 'Aucun résultat' : ML_FEEDBACK_LABELS[key] ?? key,
    value: stats.mlFeedbackBreakdown[key] ?? 0,
    color: ML_FEEDBACK_COLORS[key],
  }));

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Vue d'ensemble" subtitle="Métriques globales cross-agences — lecture seule, temps réel" />

      {/* KPI */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Total agences" value={formatNumber(stats.agenciesCount)} icon={Building2} accent="indigo" />
        <KpiCard label="Total leads" value={formatNumber(stats.leadsCount)} icon={MapPin} accent="sky" />
        <KpiCard
          label="Score moyen"
          value={stats.avgScore != null ? formatNumber(stats.avgScore, 1) : '—'}
          icon={Gauge}
          accent="emerald"
        />
        <KpiCard
          label="Taux feedback ML"
          value={formatPercent(stats.mlFeedbackRate)}
          icon={Sparkles}
          accent="amber"
          sub={`${formatNumber(stats.leadsCount - (stats.mlFeedbackBreakdown.aucun ?? 0))} lead(s) renseigné(s)`}
        />
      </section>

      {/* Graphiques */}
      <section className="grid gap-4 lg:grid-cols-2">
        <Panel title="Leads insérés / jour" subtitle="30 derniers jours" bodyClassName="px-3 py-4">
          <LeadsAreaChart data={leadsPerDay} />
        </Panel>
        <Panel title="Répartition feedbacks ML" subtitle="Résultat terrain des leads" bodyClassName="p-5">
          <MlFeedbackDonut data={donutData} />
        </Panel>
      </section>

      {/* Dernières agences */}
      <Panel
        title="Dernières agences créées"
        action={
          <Link href="/agences" className="text-xs font-medium text-indigo-400 hover:text-indigo-300">
            Tout voir →
          </Link>
        }
        bodyClassName="overflow-x-auto"
      >
        <table className="data-table">
          <thead>
            <tr>
              <th>Agence</th>
              <th>Plan</th>
              <th>Créée le</th>
              <th className="text-right">Leads</th>
              <th className="text-right">Membres</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {recentAgencies.map((agency) => (
              <tr key={agency.id}>
                <td>
                  <Link href={`/agences/${agency.id}`} className="font-medium text-white hover:text-indigo-300">
                    {agency.name}
                  </Link>
                </td>
                <td className="text-white/60">{PLAN_LABELS[agency.plan] ?? agency.plan}</td>
                <td className="whitespace-nowrap text-white/50">{formatDate(agency.created_at)}</td>
                <td className="text-right font-semibold tabular-nums text-white">{agency.leadsCount}</td>
                <td className="text-right tabular-nums text-white/70">{agency.membersCount}</td>
                <td>
                  <Badge
                    variant={
                      agency.statusLabel === 'Active'
                        ? 'success'
                        : agency.statusLabel === 'Sans membres'
                          ? 'muted'
                          : 'warning'
                    }
                  >
                    {agency.statusLabel}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
