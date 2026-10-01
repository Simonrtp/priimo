'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import styles from './dictee.module.css';

/**
 * Le texte dicté, tel qu'il arrive. Ce qui vient d'être dit apparaît en fondu
 * teinté puis rejoint le reste : l'agent voit que Priimo l'écoute, mot à mot.
 */
export default function TranscriptionVivante({
  texte,
  placeholder,
  className = '',
}: {
  texte: string;
  placeholder: string;
  className?: string;
}) {
  const [stable, setStable] = useState('');
  const precedentRef = useRef('');
  const conteneurRef = useRef<HTMLDivElement | null>(null);

  // Ce qui était déjà affiché devient stable ; seul le complément s'anime.
  useLayoutEffect(() => {
    const avant = precedentRef.current;
    setStable(texte.startsWith(avant) ? avant : texte);
    precedentRef.current = texte;
  }, [texte]);

  useEffect(() => {
    const el = conteneurRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [texte]);

  const neuf = texte.startsWith(stable) ? texte.slice(stable.length) : '';

  return (
    <div
      ref={conteneurRef}
      aria-live="polite"
      aria-atomic="false"
      className={`overflow-y-auto overscroll-contain text-pretty ${className}`}
    >
      {texte ? (
        <p className="whitespace-pre-wrap font-medium leading-relaxed text-text-strong">
          {stable}
          {neuf ? (
            <span key={stable.length} className={styles.motNeuf}>
              {neuf}
            </span>
          ) : null}
        </p>
      ) : (
        <p className="leading-relaxed text-text-subtle">{placeholder}</p>
      )}
    </div>
  );
}
