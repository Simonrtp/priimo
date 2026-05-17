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
    blue: 'bg-blue',
    none: 'bg-transparent',
  };
  return (
    <div className="w-[200px] max-md:flex-shrink-0 md:w-auto rounded-2xl border border-black/8 bg-white shadow-soft overflow-hidden snap-start">
      {accentBar !== 'none' && <div className={`h-[3px] ${barColors[accentBar]}`} />}
      <div className="px-5 pb-5" style={{ paddingTop: accentBar === 'none' ? 20 : 16 }}>
        <p
          className="mb-3 uppercase tracking-widest text-mute"
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

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export default function StatsBar({ leads }: StatsBarProps) {
  const cutoff = Date.now() - SEVEN_DAYS_MS;

  const nouveaux = leads.filter((l) => l.status === 'nouveau' && Date.parse(l.createdAt) >= cutoff).length;

  const contactes = leads.filter(
    (l) => l.status === 'contacte' || l.status === 'interesse' || l.status === 'mandat_signe',
  ).length;

  const scoreMoyen =
    leads.length > 0 ? Math.round(leads.reduce((s, l) => s + l.score, 0) / leads.length) : 0;

  const scoreColor = scoreMoyen >= 80 ? '#C2410C' : scoreMoyen >= 60 ? '#B45309' : '#64748B';

  return (
    <>
      <div className="-mx-4 mb-5 max-md:px-4 md:mx-0 md:px-0">
        <div className="flex max-md:snap-x max-md:snap-mandatory max-md:gap-3 max-md:overflow-x-auto max-md:pb-2 md:grid md:grid-cols-3 md:gap-4 md:overflow-visible">
          <KPICard label="Nouveaux cette semaine" value={nouveaux} accentBar="orange" valueColor="#C25E2C" />
          <KPICard label="Contactés" value={contactes} accentBar="blue" valueColor="#293F5C" />
          <KPICard label="Score moyen" value={scoreMoyen} accentBar="none" valueColor={scoreColor} />
        </div>
      </div>
      <div className="mb-2 flex justify-center gap-1.5 md:hidden" aria-hidden>
        <span className="h-1.5 w-1.5 rounded-full bg-accent" />
        <span className="h-1.5 w-1.5 rounded-full bg-black/15" />
        <span className="h-1.5 w-1.5 rounded-full bg-black/15" />
      </div>
    </>
  );
}
