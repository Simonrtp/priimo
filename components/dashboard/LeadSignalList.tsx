'use client';

import type { LeadSignal } from '@/types/lead';
import { resolveSignalLabel, resolveSignalPts, sortSignalsByPts } from '@/lib/lead-display';

interface LeadSignalListProps {
  signals: LeadSignal[];
  /**
   * - `summary` : liste carte — uniquement « + X signaux »
   * - `detail` : drawer / fiche — détail complet
   */
  variant?: 'summary' | 'detail';
}

export default function LeadSignalList({ signals, variant = 'detail' }: LeadSignalListProps) {
  const sorted = sortSignalsByPts(signals);

  if (sorted.length === 0) {
    if (variant === 'summary') return null;
    return (
      <p className="text-mute" style={{ fontSize: 12.5 }}>
        Aucun signal détecté
      </p>
    );
  }

  if (variant === 'summary') {
    return (
      <p className="font-medium text-accent-dark" style={{ fontSize: 11.5 }}>
        + {sorted.length} {sorted.length > 1 ? 'signaux' : 'signal'}
      </p>
    );
  }

  const totalPts = sorted.reduce((acc, s) => acc + resolveSignalPts(s), 0);

  return (
    <>
      <ul className="space-y-3">
        {sorted.map((s, i) => {
          const label = resolveSignalLabel(s);
          const pts = resolveSignalPts(s);
          return (
            <li
              key={`${s.type}-${i}-${label}`}
              className="flex items-start justify-between gap-3"
            >
              <p className="min-w-0 flex-1 font-medium leading-snug text-ink" style={{ fontSize: 13 }}>
                {label}
              </p>
              <span className="flex-shrink-0 tabular text-mute" style={{ fontSize: 12 }}>
                +{pts} pts
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-4 font-medium tabular text-mute" style={{ fontSize: 12 }}>
        Total signaux : +{totalPts} pts
      </p>
    </>
  );
}
