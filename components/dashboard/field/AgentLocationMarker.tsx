'use client';

import type { DevicePosition } from '@/lib/voice/gps';

/** Point agent — bleu, pas orange (réservé aux leads). */
const AGENT_BLUE = '#2B6CB0';
const AGENT_BLUE_SOFT = 'rgba(43, 108, 176, 0.18)';

export default function AgentLocationMarker({
  position,
}: {
  position: DevicePosition;
}) {
  const heading =
    position.headingDeg != null && Number.isFinite(position.headingDeg)
      ? position.headingDeg
      : null;
  const accuracy = position.accuracyM != null && position.accuracyM > 0 ? position.accuracyM : null;
  const accuracyPx = accuracy ? Math.min(120, Math.max(24, accuracy * 0.55)) : null;

  return (
    <div className="pointer-events-none relative flex items-center justify-center" aria-hidden>
      {accuracyPx ? (
        <span
          className="absolute rounded-full"
          style={{
            width: accuracyPx * 2,
            height: accuracyPx * 2,
            backgroundColor: AGENT_BLUE_SOFT,
          }}
        />
      ) : null}
      {heading != null ? (
        <span
          className="absolute"
          style={{
            width: 0,
            height: 0,
            borderLeft: '7px solid transparent',
            borderRight: '7px solid transparent',
            borderBottom: `18px solid ${AGENT_BLUE}`,
            transform: `translateY(-14px) rotate(${heading}deg)`,
            transformOrigin: '50% 100%',
            opacity: 0.85,
          }}
        />
      ) : null}
      <span
        className="relative block size-4 rounded-full border-[2.5px] border-white shadow-md"
        style={{ backgroundColor: AGENT_BLUE }}
      />
    </div>
  );
}

export { AGENT_BLUE };
