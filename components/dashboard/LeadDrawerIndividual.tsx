'use client';

import { ICONS, ICON_COLORS, ICON_SIZE } from '@/lib/iconMapping';

export default function LeadDrawerIndividual() {
  return (
    <div
      className="rounded-xl border border-black/[0.06] bg-soft-gray/60 px-4 py-4 text-mute"
      style={{ fontSize: 12.5, lineHeight: 1.6 }}
    >
      <p className="mb-2 flex items-center gap-2 font-semibold text-ink" style={{ fontSize: 13 }}>
        <ICONS.lock className="flex-shrink-0" size={20} color={ICON_COLORS.neutral} strokeWidth={2} aria-hidden />
        Conformité RGPD
      </p>
      <p className="mb-2">
        Les coordonnées personnelles des particuliers ne sont jamais affichées.
      </p>
      <p className="text-ink/90">
        Action recommandée : porte-à-porte ou courrier ciblé à l’adresse ci-dessus.
      </p>
    </div>
  );
}
