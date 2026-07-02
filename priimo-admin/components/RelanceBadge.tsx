import { AlertTriangle, Bell, BellRing, Clock } from 'lucide-react';
import { DIRECTOR_FOLLOWUP_DAYS, getDirectorFollowupInfo, type DirectorFollowupStatus } from '@/lib/utils/format';

const STYLES: Record<DirectorFollowupStatus, { wrap: string; icon: typeof Bell }> = {
  overdue: {
    wrap: 'border-red-500/40 bg-red-500/15 text-red-300 shadow-[0_0_0_1px_rgba(239,68,68,0.15)]',
    icon: AlertTriangle,
  },
  due: {
    wrap: 'border-amber-400/50 bg-amber-500/20 text-amber-300',
    icon: BellRing,
  },
  soon: {
    wrap: 'border-amber-500/25 bg-amber-500/10 text-amber-400/90',
    icon: Bell,
  },
  upcoming: {
    wrap: 'border-white/10 bg-white/[0.04] text-white/45',
    icon: Clock,
  },
};

/**
 * Rendu bien visible du statut de relance fondateur (J+14 après inscription
 * d'un directeur) : badge coloré + icône, jamais un simple texte discret.
 */
export function RelanceBadge({
  registeredAt,
  size = 'md',
}: {
  registeredAt: string;
  size?: 'sm' | 'md';
}) {
  const info = getDirectorFollowupInfo(registeredAt);
  const { wrap, icon: Icon } = STYLES[info.status];
  const pulse = info.status === 'overdue' || info.status === 'due';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-semibold leading-tight ${wrap} ${
        size === 'sm' ? 'text-[10px]' : 'text-xs'
      }`}
      title={`Relance fondateur J+${DIRECTOR_FOLLOWUP_DAYS} — prévue le ${new Intl.DateTimeFormat('fr-FR', {
        dateStyle: 'long',
      }).format(info.followupAt)}`}
    >
      {pulse ? (
        <span className="relative flex h-1.5 w-1.5 shrink-0">
          <span
            className={`absolute inline-flex h-full w-full animate-ping rounded-full ${
              info.status === 'overdue' ? 'bg-red-400/70' : 'bg-amber-400/70'
            }`}
          />
          <span className={`relative h-1.5 w-1.5 rounded-full ${info.status === 'overdue' ? 'bg-red-400' : 'bg-amber-400'}`} />
        </span>
      ) : (
        <Icon className={size === 'sm' ? 'h-2.5 w-2.5 shrink-0' : 'h-3 w-3 shrink-0'} />
      )}
      {size === 'sm' ? info.shortLabel : info.label}
    </span>
  );
}
