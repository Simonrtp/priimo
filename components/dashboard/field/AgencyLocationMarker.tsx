'use client';

import { Home } from 'lucide-react';
import { AGENT_BLUE } from '@/components/dashboard/field/AgentLocationMarker';

/** Repère agence — rond bleu + maison (distinct du point agent). */
export default function AgencyLocationMarker({ size = 32 }: { size?: number }) {
  const icon = Math.round(size * 0.42);
  return (
    <div
      className="pointer-events-none flex items-center justify-center"
      role="img"
      aria-label="Agence"
    >
      <span
        className="flex items-center justify-center rounded-full border-2 border-white shadow-md"
        style={{
          width: size,
          height: size,
          backgroundColor: AGENT_BLUE,
        }}
      >
        <Home size={icon} strokeWidth={2.4} className="text-white" aria-hidden />
      </span>
    </div>
  );
}
