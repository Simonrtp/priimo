import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  FileText,
  Flame,
  Zap,
} from 'lucide-react';

const ACCENT_ORANGE = '#E8743C';
const ACCENT_LIGHT = '#F4A87A';
const SLATE = '#3D5A80';
const POSITIVE = '#059669';
const NEGATIVE = '#DC2626';
const DELTA_NEUTRAL = '#6B7280';

type DeltaTone = 'positive' | 'negative' | 'neutral';

function OverviewKpiCard({
  label,
  value,
  delta,
  deltaTone,
  accentBar,
}: {
  label: string;
  value: string | number;
  delta: string;
  deltaTone: DeltaTone;
  accentBar: 'orange' | 'blue' | 'none';
}) {
  const bar =
    accentBar === 'orange'
      ? 'bg-accent'
      : accentBar === 'blue'
        ? 'bg-blue'
        : 'bg-transparent';
  const deltaColor =
    deltaTone === 'positive' ? POSITIVE : deltaTone === 'negative' ? NEGATIVE : DELTA_NEUTRAL;

  return (
    <div className="overflow-hidden rounded-2xl border border-black/8 bg-white shadow-soft">
      {accentBar !== 'none' && <div className={`h-[3px] ${bar}`} />}
      <div className="px-5 pb-5" style={{ paddingTop: accentBar === 'none' ? 20 : 16 }}>
        <p
          className="mb-3 uppercase tracking-widest text-mute"
          style={{ fontSize: 9, letterSpacing: '0.15em' }}
        >
          {label}
        </p>
        <p className="font-bold tabular leading-none text-ink" style={{ fontSize: 42 }}>
          {value}
        </p>
        <p className="mt-2 font-medium tabular" style={{ fontSize: 12, color: deltaColor }}>
          {delta}
        </p>
      </div>
    </div>
  );
}

/** 6 derniers mois : déc. → mai (données mock). */
const ACTIVITY_MONTHS: { label: string; received: number; contacted: number }[] = [
  { label: 'déc.', received: 32, contacted: 22 },
  { label: 'janv.', received: 38, contacted: 24 },
  { label: 'févr.', received: 41, contacted: 28 },
  { label: 'mars', received: 45, contacted: 30 },
  { label: 'avr.', received: 44, contacted: 29 },
  { label: 'mai', received: 47, contacted: 31 },
];

const TEAM_ROWS = [
  { agent: 'Marie Dupont', assigned: 18, contacted: 14, mandates: 2, rate: '11.1%' },
  { agent: 'Thomas Leroy', assigned: 15, contacted: 12, mandates: 1, rate: '6.7%' },
  { agent: 'Julie Martin', assigned: 14, contacted: 5, mandates: 0, rate: '0%' },
];

const SIGNAL_FEED: {
  time: string;
  title: string;
  address: string;
  Icon: LucideIcon;
  iconColor: string;
}[] = [
  {
    time: 'il y a 2h',
    title: 'Dissolution SCI détectée',
    address: '8 bd Vincent Auriol, 75013',
    Icon: AlertTriangle,
    iconColor: ACCENT_ORANGE,
  },
  {
    time: 'il y a 5h',
    title: 'Nouveau DPE classé F',
    address: '12 rue des Acacias, 75013',
    Icon: Zap,
    iconColor: '#F59E0B',
  },
  {
    time: 'hier',
    title: 'Cession de parts SCI',
    address: "45 av d'Italie, 75013",
    Icon: FileText,
    iconColor: SLATE,
  },
  {
    time: 'il y a 2j',
    title: 'DPE refait',
    address: '3 rue Bobillot, 75013',
    Icon: Zap,
    iconColor: ACCENT_ORANGE,
  },
  {
    time: 'il y a 3j',
    title: 'Liquidation amiable',
    address: '22 rue de Tolbiac, 75013',
    Icon: Flame,
    iconColor: '#DC2626',
  },
];

function ActivityChart() {
  const max = Math.max(
    ...ACTIVITY_MONTHS.flatMap((m) => [m.received, m.contacted]),
    1,
  );
  const chartHeight = 200;

  return (
    <div>
      <div className="flex items-end justify-between gap-2 px-1" style={{ height: chartHeight }}>
        {ACTIVITY_MONTHS.map((m) => (
          <div key={m.label} className="flex flex-1 flex-col items-center justify-end gap-1.5">
            <div className="flex w-full max-w-[52px] items-end justify-center gap-1" style={{ height: chartHeight - 28 }}>
              <div
                className="w-[42%] max-w-[22px] rounded-t-md"
                style={{
                  height: `${(m.received / max) * 100}%`,
                  minHeight: 8,
                  backgroundColor: ACCENT_LIGHT,
                }}
                title={`${m.received} reçus`}
              />
              <div
                className="w-[42%] max-w-[22px] rounded-t-md"
                style={{
                  height: `${(m.contacted / max) * 100}%`,
                  minHeight: 8,
                  backgroundColor: SLATE,
                }}
                title={`${m.contacted} contactés`}
              />
            </div>
            <span className="font-medium text-mute" style={{ fontSize: 11 }}>
              {m.label}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-6 border-t border-black/[0.06] pt-4">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: ACCENT_LIGHT }} aria-hidden />
          <span className="text-mute" style={{ fontSize: 12 }}>
            Leads reçus
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: SLATE }} aria-hidden />
          <span className="text-mute" style={{ fontSize: 12 }}>
            Leads contactés
          </span>
        </div>
      </div>
    </div>
  );
}

export default function OverviewDashboard() {
  return (
    <div className="max-w-6xl">
      <header className="mb-6">
        <h1 className="font-semibold tracking-tight text-ink" style={{ fontSize: 22, letterSpacing: '-0.02em' }}>
          Tableau de bord
        </h1>
        <p className="mt-1 text-mute" style={{ fontSize: 14, lineHeight: 1.5 }}>
          Synthèse de l’activité de votre agence — données indicatives (démo).
        </p>
      </header>

      {/* Section 1 — KPI */}
      <section className="mb-8" aria-labelledby="overview-kpi-heading">
        <h2 id="overview-kpi-heading" className="sr-only">
          Indicateurs clés
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <OverviewKpiCard
            label="Leads reçus ce mois"
            value={47}
            delta="+18 % vs mois dernier"
            deltaTone="positive"
            accentBar="orange"
          />
          <OverviewKpiCard
            label="Leads contactés"
            value={31}
            delta="66 % du total"
            deltaTone="neutral"
            accentBar="blue"
          />
          <OverviewKpiCard
            label="Mandats signés via Priimo"
            value={3}
            delta="+2 vs mois dernier"
            deltaTone="positive"
            accentBar="orange"
          />
          <OverviewKpiCard
            label="Taux de conversion"
            value="6,4 %"
            delta="+1,2 pts vs mois dernier"
            deltaTone="positive"
            accentBar="blue"
          />
        </div>
      </section>

      {/* Section 2 — Graphique */}
      <section
        className="mb-8 rounded-2xl border border-black/8 bg-white px-6 py-6 shadow-soft"
        aria-labelledby="overview-activity-heading"
      >
        <h2
          id="overview-activity-heading"
          className="mb-1 font-semibold text-ink"
          style={{ fontSize: 15, letterSpacing: '-0.01em' }}
        >
          Activité — 6 derniers mois
        </h2>
        <p className="mb-6 text-mute" style={{ fontSize: 12.5 }}>
          Volume de leads reçus et contactés sur votre territoire.
        </p>
        <ActivityChart />
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Section 3 — Tableau équipe */}
        <section
          className="rounded-2xl border border-black/8 bg-white shadow-soft"
          aria-labelledby="overview-team-heading"
        >
          <div className="border-b border-black/[0.06] px-5 py-4">
            <h2
              id="overview-team-heading"
              className="font-semibold text-ink"
              style={{ fontSize: 15, letterSpacing: '-0.01em' }}
            >
              Performance de l’équipe
            </h2>
            <p className="mt-0.5 text-mute" style={{ fontSize: 12 }}>
              Ce mois (données démo).
            </p>
          </div>
          <div className="overflow-x-auto px-1 pb-1">
            <table className="w-full text-left" style={{ fontSize: 13 }}>
              <thead>
                <tr className="border-b border-black/[0.06] text-mute">
                  <th className="px-4 py-3 font-medium" scope="col">
                    Agent
                  </th>
                  <th className="px-3 py-3 font-medium tabular" scope="col">
                    Assignés
                  </th>
                  <th className="px-3 py-3 font-medium tabular" scope="col">
                    Contactés
                  </th>
                  <th className="px-3 py-3 font-medium tabular" scope="col">
                    Mandats
                  </th>
                  <th className="px-4 py-3 font-medium tabular text-right" scope="col">
                    Taux
                  </th>
                </tr>
              </thead>
              <tbody>
                {TEAM_ROWS.map((row) => (
                  <tr key={row.agent} className="border-b border-black/[0.05] last:border-0">
                    <td className="px-4 py-3.5 font-medium text-ink">{row.agent}</td>
                    <td className="px-3 py-3.5 tabular text-ink">{row.assigned}</td>
                    <td className="px-3 py-3.5 tabular text-ink">{row.contacted}</td>
                    <td className="px-3 py-3.5 tabular text-ink">{row.mandates}</td>
                    <td className="px-4 py-3.5 text-right tabular text-mute">{row.rate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 4 — Feed signaux */}
        <section
          className="rounded-2xl border border-black/8 bg-white shadow-soft"
          aria-labelledby="overview-signals-heading"
        >
          <div className="border-b border-black/[0.06] px-5 py-4">
            <h2
              id="overview-signals-heading"
              className="font-semibold text-ink"
              style={{ fontSize: 15, letterSpacing: '-0.01em' }}
            >
              Derniers signaux détectés
            </h2>
            <p className="mt-0.5 text-mute" style={{ fontSize: 12 }}>
              Votre zone — les événements les plus récents.
            </p>
          </div>
          <ul className="divide-y divide-black/[0.05] px-5 py-2">
            {SIGNAL_FEED.map((item) => {
              const SignalIcon = item.Icon;
              return (
              <li key={`${item.time}-${item.title}`} className="flex gap-3 py-4 first:pt-3 last:pb-3">
                <div
                  className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-black/[0.06] bg-soft-gray/40"
                  aria-hidden
                >
                  <SignalIcon size={18} color={item.iconColor} strokeWidth={2} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium tabular text-mute" style={{ fontSize: 11 }}>
                    {item.time}
                  </p>
                  <p className="mt-1 text-ink" style={{ fontSize: 13, lineHeight: 1.45 }}>
                    <span className="font-semibold">{item.title}</span>
                    <span className="text-mute"> — </span>
                    <span className="text-mute">{item.address}</span>
                  </p>
                </div>
              </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
}
