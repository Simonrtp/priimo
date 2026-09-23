'use client';

import { NUANCIER_ACCENT, NUANCIER_ACCENT2 } from '@/lib/rapport/couleurs';
import SelecteurCouleurAvis from '@/components/dashboard/settings/SelecteurCouleurAvis';

const NUANCIER = [...NUANCIER_ACCENT, ...NUANCIER_ACCENT2];

export default function NuancierAvis({
  accent,
  accent2,
  onAccent,
  onAccent2,
  compact,
}: {
  accent: string;
  accent2: string;
  onAccent: (hex: string) => void;
  onAccent2: (hex: string) => void;
  compact?: boolean;
}) {
  return (
    <div className={compact ? 'flex flex-wrap items-start gap-2' : 'grid gap-4'}>
      {compact ? null : (
        <div className="overflow-hidden rounded-clay border border-black/[0.08] bg-white">
          <div className="flex items-center px-4 pt-3">
            <p className="flex gap-2 text-[15px] uppercase">
              <span className="font-bold" style={{ color: accent }}>
                Avis de
              </span>
              <span style={{ color: accent2 }}>valeur</span>
            </p>
          </div>
          <div className="mt-2 flex items-center px-4">
            <span className="h-1 w-20 shrink-0" style={{ backgroundColor: accent }} aria-hidden />
            <span className="h-px flex-1 opacity-35" style={{ backgroundColor: accent }} aria-hidden />
          </div>
          <div
            className="mt-3 flex h-8 items-center px-4 text-[11px] text-white"
            style={{ backgroundColor: accent2 }}
          >
            Pied de page
          </div>
        </div>
      )}
      <div className={compact ? 'contents' : 'grid gap-2 sm:grid-cols-2'}>
        <SelecteurCouleurAvis
          id="avis-accent"
          label="Couleur principale"
          value={accent}
          options={NUANCIER}
          onChange={onAccent}
        />
        <SelecteurCouleurAvis
          id="avis-accent-2"
          label="Couleur secondaire"
          value={accent2}
          options={NUANCIER}
          onChange={onAccent2}
        />
      </div>
    </div>
  );
}
