'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import ScoreRing from '../ScoreRing';
import {
  elementPipelineVisible,
  keyframesVol,
  VOL_CHIP,
  VOL_DUREE_MS,
  type VolLead,
} from '@/lib/ui/vol-pipeline';

function PuceVol({ vol, onFini }: { vol: VolLead; onFini: (id: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const onFiniRef = useRef(onFini);
  onFiniRef.current = onFini;

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof el.animate !== 'function') {
      onFiniRef.current(vol.id);
      return;
    }
    let actif = true;
    el.style.willChange = 'transform, opacity';
    const anim = el.animate(keyframesVol(vol), {
      duration: VOL_DUREE_MS,
      easing: 'ease-out',
      fill: 'forwards',
    });
    anim.onfinish = () => {
      if (!actif) return;
      el.style.willChange = '';
      onFiniRef.current(vol.id);
    };
    return () => {
      actif = false;
      anim.cancel();
      el.style.willChange = '';
    };
  }, [vol]);

  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-40 flex items-center gap-2 rounded-full border border-black/[0.08] bg-white px-2.5 shadow-clay"
      style={{
        width: VOL_CHIP.w,
        height: VOL_CHIP.h,
        transform: `translate3d(${vol.start.x}px, ${vol.start.y}px, 0)`,
      }}
    >
      <ScoreRing score={vol.score} size={28} />
      <span className="min-w-0 truncate text-[12.5px] font-semibold text-ink">{vol.adresse}</span>
    </div>
  );
}

export default function VolLeadPipeline({
  vols,
  onFini,
}: {
  vols: VolLead[];
  onFini: (id: string) => void;
}) {
  useEffect(() => {
    const el = elementPipelineVisible();
    if (!el || vols.length === 0) return;
    el.classList.add('pipeline-attend');
    return () => el.classList.remove('pipeline-attend');
  }, [vols.length]);

  if (typeof document === 'undefined' || vols.length === 0) return null;
  return createPortal(
    <>
      {vols.map((vol) => (
        <PuceVol key={vol.id} vol={vol} onFini={onFini} />
      ))}
    </>,
    document.body,
  );
}
