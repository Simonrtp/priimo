'use client';

import { useEffect, useState } from 'react';
import { pickDashboardWelcomeMessage, welcomeTypeDelay } from '@/lib/dashboard-welcome';
import { renderWithPriimoBrand } from '@/components/brand/PriimoWord';

type DashboardWelcomeProps = {
  firstName: string;
  className?: string;
};

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return reduced;
}

function useTypewriter(text: string | null, enabled: boolean) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!text) {
      setDisplayed('');
      setDone(false);
      return;
    }

    if (!enabled) {
      setDisplayed(text);
      setDone(true);
      return;
    }

    const chars = [...text];
    let index = 0;
    let timeoutId = 0;

    setDisplayed('');
    setDone(false);

    const typeNext = () => {
      if (index >= chars.length) {
        setDone(true);
        return;
      }

      index += 1;
      setDisplayed(chars.slice(0, index).join(''));

      const char = chars[index - 1]!;
      const nextChar = chars[index];
      timeoutId = window.setTimeout(typeNext, welcomeTypeDelay(char, nextChar));
    };

    timeoutId = window.setTimeout(typeNext, 320);

    return () => window.clearTimeout(timeoutId);
  }, [text, enabled]);

  return { displayed, done };
}

export default function DashboardWelcome({ firstName, className = '' }: DashboardWelcomeProps) {
  const [message, setMessage] = useState<string | null>(null);
  const reducedMotion = usePrefersReducedMotion();
  const { displayed, done } = useTypewriter(message, !reducedMotion);

  useEffect(() => {
    setMessage(pickDashboardWelcomeMessage(firstName));
  }, [firstName]);

  const textClass =
    'font-display text-pretty font-semibold leading-snug text-[var(--text-strong)] text-[22px] md:text-[19px] md:font-medium';

  if (!message) {
    return (
      <div className={`grid ${className}`} aria-hidden>
        <p className={`${textClass} invisible col-start-1 row-start-1`}>&nbsp;</p>
      </div>
    );
  }

  return (
    <div className={`grid ${className}`}>
      {/* Réserve l'espace pour éviter les sauts de layout pendant la frappe */}
      <p className={`${textClass} invisible col-start-1 row-start-1 select-none`} aria-hidden>
        {message}
      </p>

      <p
        className={`${textClass} col-start-1 row-start-1`}
        aria-live={done ? 'polite' : 'off'}
        aria-label={done ? undefined : message}
      >
        {renderWithPriimoBrand(displayed)}
        {!done && (
          <span
            className="welcome-type-cursor ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[0.12em] rounded-full bg-primary-500 align-middle"
            aria-hidden
          />
        )}
      </p>
    </div>
  );
}
