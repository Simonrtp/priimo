'use client';

import type { CarteComprise } from '@/lib/voice/cartes';
import IconeCarte from './IconeCarte';
import styles from './dictee.module.css';

/**
 * Ce que Priimo a compris, carte par carte.
 *
 * Chaque carte garde sa clé d'une lecture à l'autre : elle n'entre (en
 * glissant) qu'une fois, à son apparition. Quand une lecture la reformule, seul
 * son texte se redessine en fondu — clé sur la signature du texte.
 */
export default function CartesComprises({
  cartes,
  compact = false,
  lecture = false,
}: {
  cartes: readonly CarteComprise[];
  compact?: boolean;
  /** Une lecture est en cours : la dernière carte porte un reflet. */
  lecture?: boolean;
}) {
  if (cartes.length === 0) return null;

  return (
    <ul className={`flex flex-col ${compact ? 'gap-1.5' : 'gap-2'}`} aria-label="Ce que Priimo a compris">
      {cartes.map((c, i) => {
        const reflet = lecture && i === cartes.length - 1 ? styles.lectureReflet : '';
        return (
          <li
            key={c.key}
            className={`flex items-center gap-3 rounded-2xl border border-black/[0.06] bg-surface ${
              compact ? 'px-2.5 py-2' : 'px-3 py-2.5'
            } shadow-clay-sm ${styles.carteEntree} ${reflet}`}
          >
            <IconeCarte kind={c.kind} size={compact ? 28 : 32} />
            <span key={`${c.titre}|${c.detail}`} className={`min-w-0 flex-1 ${styles.texteMaj}`}>
              <span
                className="block truncate font-semibold text-text-strong"
                style={{ fontSize: compact ? 13 : 14 }}
              >
                {c.titre}
              </span>
              {c.detail ? (
                <span className="block truncate text-text-muted" style={{ fontSize: compact ? 11.5 : 12.5 }}>
                  {c.detail}
                </span>
              ) : null}
            </span>
            {c.badge && !compact ? (
              <span className="shrink-0 rounded-full bg-primary-50 px-2 py-0.5 text-[11px] font-semibold text-primary-600">
                {c.badge}
              </span>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
