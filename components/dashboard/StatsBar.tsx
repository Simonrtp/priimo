import type { Lead } from '@/types/lead';

interface StatsBarProps {
  leads: Lead[];
}

interface KPICardProps {
  label: string;
  value: number | string;
  accentBar?: 'orange' | 'blue' | 'none';
  valueColor?: string;
}

function KPICard({ label, value, accentBar = 'none', valueColor = '#111827' }: KPICardProps) {
  const barColors = {
    orange: 'bg-accent',
    blue:   'bg-blue',
    none:   'bg-transparent',
  };
  return (
    <div className="rounded-2xl bg-white shadow-soft border border-black/8 overflow-hidden">
      {accentBar !== 'none' && <div className={`h-[3px] ${barColors[accentBar]}`} />}
      <div className="px-5 pb-5" style={{ paddingTop: accentBar === 'none' ? 20 : 16 }}>
        <p
          className="uppercase tracking-widest text-mute mb-3"
          style={{ fontSize: 9, letterSpacing: '0.15em' }}
        >
          {label}
        </p>
        <p className="font-bold tabular leading-none" style={{ fontSize: 42, color: valueColor }}>
          {value}
        </p>
      </div>
    </div>
  );
}

export default function StatsBar({ leads }: StatsBarProps) {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const nouveaux = leads.filter(
    (l) => l.status === 'nouveau' && new Date(l.createdAt) >= sevenDaysAgo
  ).length;

  const contactes = leads.filter(
    (l) => l.status === 'contacté' || l.status === 'intéressé'
  ).length;

  const scoreMoyen = leads.length > 0
    ? Math.round(leads.reduce((s, l) => s + l.score, 0) / leads.length)
    : 0;

  const scoreColor = scoreMoyen >= 70 ? '#E8743C' : scoreMoyen >= 50 ? '#3D5A80' : '#9CA3AF';

  return (
    <div className="grid grid-cols-3 gap-4 mb-5">
      <KPICard label="Nouveaux cette semaine" value={nouveaux}   accentBar="orange" valueColor="#C25E2C" />
      <KPICard label="Contactés"              value={contactes}  accentBar="blue"   valueColor="#293F5C" />
      <KPICard label="Score moyen"            value={scoreMoyen} accentBar="none"   valueColor={scoreColor} />
    </div>
  );
}
