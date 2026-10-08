'use client';

import { ChevronUp, Lock } from 'lucide-react';

/** La couleur de l'IA : la dictée lui est confiée. */
const IA = '#6366F1';
const IA_CLAIR = '#A5B4FC';
const IA_PASTEL = '#E0E7FF';
import { voiceLockProgress } from '@/lib/voice/gesture-lock';

export default function VoiceLockHint({
  locked,
  progress = 0,
  compact = false,
}: {
  locked: boolean;
  progress?: number;
  compact?: boolean;
}) {
  if (locked) {
    return (
      <div
        className={`flex items-center justify-center gap-2 rounded-full bg-ia-50 px-3 py-1.5 ${
          compact ? '' : 'mt-6'
        }`}
      >
        <Lock size={14} strokeWidth={2.25} style={{ color: IA }} aria-hidden />
        <span className="text-[12px] font-semibold" style={{ color: IA }}>
          Dictée verrouillée
        </span>
      </div>
    );
  }

  const p = voiceLockProgress(progress);

  return (
    <div
      className={`flex flex-col items-center ${compact ? 'gap-1' : 'mt-8 gap-1.5'}`}
      aria-hidden
    >
      <div
        className="flex flex-col items-center transition-transform duration-fluid-subtle ease-in-out"
        style={{
          transform: `translateY(${-p * 24}px)`,
          opacity: 0.4 + p * 0.6,
        }}
      >
        <ChevronUp size={18} strokeWidth={2.5} style={{ color: IA_CLAIR }} />
        <ChevronUp size={18} strokeWidth={2.5} className="-mt-3 opacity-60" style={{ color: IA_CLAIR }} />
      </div>
      <div
        className="flex size-10 items-center justify-center rounded-full border border-black/[0.08] bg-surface shadow-soft transition-transform duration-fluid-subtle ease-in-out"
        style={{
          transform: `scale(${1 + p * 0.1})`,
          boxShadow: p > 0.85 ? `0 0 0 3px ${IA_PASTEL}` : undefined,
        }}
      >
        <Lock size={17} strokeWidth={2.25} style={{ color: IA }} />
      </div>
      <p className={`text-center font-medium text-text-muted ${compact ? 'text-[10px]' : 'text-[12px]'}`}>
        Glisser vers le haut pour bloquer
      </p>
    </div>
  );
}
