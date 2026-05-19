'use client';

import { ICONS } from '@/lib/iconMapping';

export default function MapViewPlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-black/8 bg-[#F4F4F2] px-6 text-center shadow-soft" style={{ minHeight: 480 }}>
      <div
        className="mb-5 flex items-center justify-center rounded-2xl border border-black/[0.06] bg-white/80"
        style={{ width: 72, height: 72 }}
      >
        <ICONS.map className="text-accent" size={40} strokeWidth={2} aria-hidden />
      </div>
      <p className="mb-1 font-semibold text-ink" style={{ fontSize: 16, letterSpacing: '-0.02em' }}>
        Vue carte
      </p>
      <p className="max-w-md text-mute" style={{ fontSize: 13, lineHeight: 1.55 }}>
        Fonctionnalité qui arrive bientôt — vous pourrez visualiser vos prospects sur une carte
        interactive.
      </p>
    </div>
  );
}
