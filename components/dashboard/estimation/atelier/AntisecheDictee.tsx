'use client';

import { GROUPES_ANTISECHE_ESTIMATION } from '@/lib/estimation/antiseche';

/** Rappel compact : ce qu’on peut mentionner, pas un script. */
export default function AntisecheDictee({ compact = false }: { compact?: boolean }) {
  return (
    <div>
      <p className="text-pretty text-text-muted" style={{ fontSize: compact ? 11.5 : 12 }}>
        Parlez comme à un collègue. L’ordre et les noms de champs n’ont pas d’importance.
      </p>
      <ul
        className={
          compact
            ? 'mt-2 flex flex-col gap-1'
            : 'mt-2.5 grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2'
        }
      >
        {GROUPES_ANTISECHE_ESTIMATION.map((g) => (
          <li key={g.titre} className="min-w-0 text-pretty" style={{ fontSize: compact ? 11.5 : 12, lineHeight: 1.35 }}>
            <span className="font-semibold text-text-strong">{g.titre}</span>
            <span className="text-text-muted"> — {g.champs}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
