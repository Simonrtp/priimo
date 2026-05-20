'use client';

import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { QuickFilter } from '@/lib/lead-display';
import { QUICK_FILTER_LABELS } from '@/lib/lead-display';

const CHIP_FILTERS: QuickFilter[] = [
  'ultra_hot',
  'hot',
  'passoire',
  'dpe_recent',
  'detention_5_9',
];

const ALL_FILTERS: QuickFilter[] = ['all', ...CHIP_FILTERS];

interface ProspectQuickFiltersProps {
  value: QuickFilter;
  onChange: (filter: QuickFilter) => void;
  /** Intégré dans ProspectsFiltersPanel (sans marge externe). */
  embedded?: boolean;
}

interface IndicatorRect {
  x: number;
  width: number;
  height: number;
}

function measureIndicator(container: HTMLDivElement, button: HTMLButtonElement): IndicatorRect {
  const containerRect = container.getBoundingClientRect();
  const buttonRect = button.getBoundingClientRect();
  return {
    x: buttonRect.left - containerRect.left + container.scrollLeft,
    width: buttonRect.width,
    height: buttonRect.height,
  };
}

export default function ProspectQuickFilters({
  value,
  onChange,
  embedded = false,
}: ProspectQuickFiltersProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef(new Map<QuickFilter, HTMLButtonElement>());
  const [indicator, setIndicator] = useState<IndicatorRect | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);

  const setButtonRef = useCallback((key: QuickFilter, node: HTMLButtonElement | null) => {
    if (node) buttonRefs.current.set(key, node);
    else buttonRefs.current.delete(key);
  }, []);

  const updateIndicator = useCallback(() => {
    const container = trackRef.current;
    const button = buttonRefs.current.get(value);
    if (!container || !button) return;
    setIndicator(measureIndicator(container, button));
  }, [value]);

  useLayoutEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onMq = () => setReduceMotion(mq.matches);
    onMq();
    mq.addEventListener('change', onMq);
    return () => mq.removeEventListener('change', onMq);
  }, []);

  useLayoutEffect(() => {
    updateIndicator();
    const container = trackRef.current;
    if (!container) return;

    const ro = new ResizeObserver(updateIndicator);
    ro.observe(container);
    buttonRefs.current.forEach((btn) => ro.observe(btn));
    container.addEventListener('scroll', updateIndicator, { passive: true });
    window.addEventListener('resize', updateIndicator);

    return () => {
      ro.disconnect();
      container.removeEventListener('scroll', updateIndicator);
      window.removeEventListener('resize', updateIndicator);
    };
  }, [updateIndicator]);

  return (
    <div className={embedded ? '' : 'mb-4'}>
      <p
        className="mb-2 uppercase tracking-widest text-mute"
        style={{ fontSize: 9, letterSpacing: '0.15em' }}
      >
        Raccourcis
      </p>
      <div
        ref={trackRef}
        className="relative flex gap-1 overflow-x-auto rounded-2xl bg-black/[0.04] p-1 scrollbar-none"
      >
        {indicator && (
          <span
            aria-hidden
            className="pointer-events-none absolute left-0 top-0 rounded-full bg-ink shadow-sm"
            style={{
              width: indicator.width,
              height: indicator.height,
              transform: `translate3d(${indicator.x}px, 0, 0)`,
              transition: reduceMotion ? 'none' : 'transform 0.2s cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          />
        )}

        {ALL_FILTERS.map((key) => {
          const active = value === key;
          const label = QUICK_FILTER_LABELS[key];
          return (
            <button
              key={key}
              ref={(node) => setButtonRef(key, node)}
              type="button"
              onClick={() => onChange(key === 'all' ? 'all' : value === key ? 'all' : key)}
              className={`relative z-10 flex-shrink-0 rounded-full bg-transparent font-medium ${
                active ? 'text-canvas' : 'text-ink/80 hover:text-ink'
              }`}
              style={{
                fontSize: 12,
                padding: '6px 14px',
                transition: reduceMotion ? 'none' : 'color 0.15s ease-out',
              }}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
