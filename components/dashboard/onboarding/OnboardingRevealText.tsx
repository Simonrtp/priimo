'use client';

import { useMemo } from 'react';

/**
 * Apparition fluide mot à mot (blur + rise). Respecte prefers-reduced-motion.
 */
export default function OnboardingRevealText({
  text,
  className = '',
  as: Tag = 'span',
  delayMs = 0,
  staggerMs = 48,
}: {
  text: string;
  className?: string;
  as?: 'span' | 'p' | 'h1' | 'h2';
  delayMs?: number;
  staggerMs?: number;
}) {
  const words = useMemo(() => text.split(/(\s+)/).filter(Boolean), [text]);

  return (
    <Tag className={className} aria-label={text}>
      {words.map((word, i) => {
        const isSpace = /^\s+$/.test(word);
        if (isSpace) {
          return <span key={`s-${i}`}>{word}</span>;
        }
        return (
          <span
            key={`${i}-${word}`}
            className="onb-word"
            style={{ animationDelay: `${delayMs + i * staggerMs}ms` }}
          >
            {word}
          </span>
        );
      })}
    </Tag>
  );
}
