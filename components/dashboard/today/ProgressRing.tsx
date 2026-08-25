'use client';

import { useEffect, useRef, useState } from 'react';
import { FIELD } from '@/lib/today/field';

export default function ProgressRing({
  remaining,
  total,
  complete,
  size = 'md',
}: {
  remaining: number;
  total: number;
  complete?: boolean;
  size?: 'sm' | 'md';
}) {
  const r = size === 'sm' ? 16 : 20;
  const dim = size === 'sm' ? 40 : 56;
  const c = 2 * Math.PI * r;
  const progress = complete || total <= 0 ? 1 : Math.min(1, (total - remaining) / total);
  const offset = c * (1 - progress);
  const reduced =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [animatedOffset, setAnimatedOffset] = useState(c);
  const mounted = useRef(false);

  useEffect(() => {
    if (reduced) {
      setAnimatedOffset(offset);
      return;
    }
    if (!mounted.current) {
      mounted.current = true;
      const id = requestAnimationFrame(() => setAnimatedOffset(offset));
      return () => cancelAnimationFrame(id);
    }
    setAnimatedOffset(offset);
  }, [offset, reduced]);

  return (
    <div
      className="relative flex-shrink-0"
      style={{ width: dim, height: dim }}
      role="img"
      aria-label={`${remaining} tâche${remaining > 1 ? 's' : ''} restante${remaining > 1 ? 's' : ''} sur ${total}`}
    >
      <svg viewBox="0 0 48 48" className="size-full -rotate-90" aria-hidden>
        <circle cx="24" cy="24" r={r} fill="none" stroke={FIELD.ardoisePastel} strokeWidth="4" />
        <circle
          cx="24"
          cy="24"
          r={r}
          fill="none"
          stroke={FIELD.vert}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={animatedOffset}
          style={{
            transition: reduced ? undefined : 'stroke-dashoffset 400ms ease-out',
          }}
        />
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center font-semibold tabular-nums text-text-strong"
        style={{ fontSize: size === 'sm' ? 13 : 16 }}
        aria-hidden
      >
        {remaining}
      </span>
    </div>
  );
}
