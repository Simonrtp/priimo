'use client';

import { useId } from 'react';
import { Home } from 'lucide-react';
import { AGENT_BLUE } from '@/components/dashboard/field/AgentLocationMarker';

/** Repère agence — rond bleu + maison. Au survol : « Mon agence ». */
export default function AgencyLocationMarker({ size = 32 }: { size?: number }) {
  const icon = Math.round(size * 0.42);
  const tooltipId = useId();

  return (
    <span className="priimo-pin-wrap">
      <button
        type="button"
        aria-label="Mon agence"
        aria-describedby={tooltipId}
        className="flex cursor-pointer items-center justify-center rounded-full border-2 border-white shadow-md"
        style={{
          width: size,
          height: size,
          backgroundColor: AGENT_BLUE,
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <Home size={icon} strokeWidth={2.4} className="text-white" aria-hidden />
      </button>
      <div id={tooltipId} role="tooltip" className="priimo-hover-bubble">
        <p className="priimo-hover-title" style={{ margin: 0 }}>
          Mon agence
        </p>
      </div>
    </span>
  );
}
