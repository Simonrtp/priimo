import type { Lead } from '@/types/lead';

interface StatsBarProps {
  leads: Lead[];
}

export default function StatsBar({ leads }: StatsBarProps) {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const nouveauxCetteSemaine = leads.filter(
    (l) => l.status === 'nouveau' && new Date(l.createdAt) >= sevenDaysAgo
  ).length;

  const contactes = leads.filter(
    (l) => l.status === 'contacté' || l.status === 'intéressé'
  ).length;

  const scoreMoyen =
    leads.length > 0
      ? Math.round(leads.reduce((sum, l) => sum + l.score, 0) / leads.length)
      : 0;

  const cards = [
    { label: 'Nouveaux cette semaine', value: nouveauxCetteSemaine },
    { label: 'Contactés', value: contactes },
    { label: 'Score moyen', value: scoreMoyen },
  ];

  return (
    <div className="grid grid-cols-3 gap-4 mb-6">
      {cards.map(({ label, value }) => (
        <div
          key={label}
          className="bg-white border border-[#E5E5E5] rounded-[8px] p-5"
          style={{ boxShadow: '0 1px 2px 0 rgba(0,0,0,0.04)' }}
        >
          <p
            className="font-medium uppercase tracking-wider text-gray-500 mb-1"
            style={{ fontSize: '12px' }}
          >
            {label}
          </p>
          <p className="font-bold tracking-tight text-gray-900 leading-none" style={{ fontSize: '32px' }}>
            {value}
          </p>
        </div>
      ))}
    </div>
  );
}
