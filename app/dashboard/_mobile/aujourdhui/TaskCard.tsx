'use client';

import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  Building2,
  Calculator,
  Calendar,
  Handshake,
  HousePlus,
  Inbox,
  MapPin,
  MessageSquare,
  Phone,
  Send,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { TodayCard, TodayCardType } from '@/lib/today/cards';
import { FIELD, ctaCourt, ctaLink, dotColorFor, pastelFor } from '@/lib/today/field';
import { isOverdue, temporalMention, visualLevel } from '@/lib/today/visual-level';
import { prefersReducedMotion, tapProps, vibrateBrief } from './tap';

const SWIPE_THRESHOLD = 72;

const TYPE_ICONS: Record<TodayCardType, LucideIcon> = {
  echeance_contractuelle: AlertTriangle,
  post_visite: MessageSquare,
  promesse: Handshake,
  mandat_sans_visite: Building2,
  relance: Phone,
  rapprochement: Users,
  nouvelle_adresse: MapPin,
  rendez_vous: Calendar,
  transmis: Send,
  alerte: Bell,
  demande_portail: Inbox,
  demande_estimation: HousePlus,
  estimation_vuee: Calculator,
};

export default function TaskCard({
  card,
  onAction,
  onSnooze,
  onDone,
  onConfirmDone,
}: {
  card: TodayCard;
  onAction: () => void;
  onSnooze: () => void;
  onDone: () => void;
  onConfirmDone?: () => void;
}) {
  const level = visualLevel(card);
  const startX = useRef(0);
  const startY = useRef(0);
  const swipeEnabled = card.dismissible !== false;
  const dx = useRef(0);
  const tracking = useRef(false);
  const locked = useRef<'h' | 'v' | null>(null);
  const [offset, setOffset] = useState(0);
  const [exiting, setExiting] = useState(false);

  const dotColor = dotColorFor(card.type);
  const Icon = TYPE_ICONS[card.type];
  const mention = temporalMention(card);
  const overdue = isOverdue(card);

  function reset() {
    dx.current = 0;
    locked.current = null;
    tracking.current = false;
    setOffset(0);
  }

  function finish() {
    if (level === 1 && onConfirmDone) {
      reset();
      onConfirmDone();
      return;
    }
    vibrateBrief();
    if (prefersReducedMotion()) {
      onDone();
      return;
    }
    setExiting(true);
    window.setTimeout(onDone, 200);
  }

  const swipeHandlers =
    level === 3
      ? {}
      : {
          onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
            if (!swipeEnabled) return;
            if ((e.target as HTMLElement).closest('button')) return;
            tracking.current = true;
            startX.current = e.clientX;
            startY.current = e.clientY;
            dx.current = 0;
            locked.current = null;
            e.currentTarget.setPointerCapture(e.pointerId);
          },
          onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
            if (!tracking.current || locked.current === 'v' || exiting) return;
            const mx = e.clientX - startX.current;
            const my = e.clientY - startY.current;
            if (!locked.current) {
              if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
              locked.current = Math.abs(mx) > Math.abs(my) ? 'h' : 'v';
              if (locked.current === 'v') return;
            }
            dx.current = mx;
            setOffset(Math.max(-120, Math.min(120, mx)));
          },
          onPointerUp: () => {
            if (exiting) return;
            const moved = dx.current;
            const wasSwipe = locked.current === 'h' && Math.abs(moved) >= SWIPE_THRESHOLD;
            if (wasSwipe) {
              if (moved > 0) finish();
              else onSnooze();
            }
            reset();
          },
          onPointerCancel: reset,
        };

  if (level === 3) {
    return (
      <article
        className="flex min-h-[80px] items-center gap-2.5 rounded-[16px] px-3.5 py-2.5"
        style={{ backgroundColor: FIELD.creme }}
      >
        <span
          className="size-2 flex-shrink-0 rounded-full"
          style={{ backgroundColor: dotColor }}
          aria-hidden
        />
        <Icon size={16} strokeWidth={2.2} className="flex-shrink-0 text-text-muted" aria-hidden />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold text-text-strong" style={{ fontSize: 14.5, lineHeight: 1.25 }}>
            {card.headline}
          </h3>
          {card.context ? (
            <p className="mt-0.5 truncate text-text-muted" style={{ fontSize: 12.5 }}>
              {card.context}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          className="flex-shrink-0 px-1 py-2 font-semibold text-text-strong underline decoration-black/25 underline-offset-2"
          style={{ fontSize: 13 }}
          {...tapProps(onAction)}
        >
          {ctaLink(card)}
        </button>
      </article>
    );
  }

  const isBurn = level === 1;
  const bg = isBurn ? '#FFFFFF' : pastelFor(card.type);
  const borderLeft = isBurn
    ? `4px solid ${overdue ? FIELD.rouge : FIELD.orange}`
    : undefined;

  return (
    <div className="relative overflow-hidden rounded-[20px]">
      {swipeEnabled ? (
        <div className="absolute inset-0 flex" aria-hidden>
          <div
            className="flex w-1/2 items-center pl-4 text-[13px] font-semibold text-white"
            style={{ backgroundColor: FIELD.vert }}
          >
            Terminer
          </div>
          <div
            className="flex w-1/2 items-center justify-end pr-4 text-[13px] font-semibold"
            style={{ backgroundColor: FIELD.ardoisePastel, color: FIELD.ardoise }}
          >
            Reporter
          </div>
        </div>
      ) : null}
      <article
        className={`relative flex min-h-[120px] flex-col justify-between px-4 pb-3 pt-3 ${isBurn ? 'border-l-[4px]' : ''}`}
        style={{
          backgroundColor: bg,
          borderLeftColor: isBurn ? (overdue ? FIELD.rouge : FIELD.orange) : undefined,
          transform: exiting ? 'translateX(110%)' : swipeEnabled ? `translateX(${offset}px)` : undefined,
          opacity: exiting ? 0 : 1,
          transition: exiting ? 'transform 200ms ease-out, opacity 200ms ease-out' : undefined,
          touchAction: swipeEnabled ? 'pan-y' : undefined,
        }}
        {...swipeHandlers}
      >
        <div className="flex items-start gap-2">
          <span
            className="mt-1 size-2 flex-shrink-0 rounded-full"
            style={{ backgroundColor: dotColor }}
            aria-hidden
          />
          <Icon size={17} strokeWidth={2.2} className="mt-0.5 flex-shrink-0 text-text-muted" aria-hidden />
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-2">
              <h3
                className="min-w-0 flex-1 truncate font-semibold text-text-strong"
                style={{ fontSize: 15.5, lineHeight: 1.25 }}
              >
                {card.headline}
              </h3>
              {mention ? (
                <p
                  className="max-w-[46%] shrink-0 truncate text-right font-medium tabular-nums"
                  style={{
                    fontSize: 12,
                    lineHeight: 1.25,
                    color: overdue ? FIELD.rouge : FIELD.orange,
                  }}
                >
                  {mention}
                </p>
              ) : null}
            </div>
            {card.context ? (
              <p className="mt-0.5 line-clamp-2 text-pretty text-text" style={{ fontSize: 13, lineHeight: 1.35 }}>
                {card.context}
              </p>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          className="mt-3 flex min-h-[44px] w-full items-center justify-center rounded-[12px] font-semibold text-white"
          style={{ backgroundColor: isBurn ? FIELD.orange : FIELD.orange, fontSize: 14.5 }}
          {...tapProps(onAction)}
        >
          {ctaCourt(card)}
        </button>
      </article>
    </div>
  );
}

/** Anneau vert animé — réutilisé par StatusBand. */
export function AnimatedProgressRing({
  remaining,
  total,
  complete,
  tone = 'light',
}: {
  remaining: number;
  total: number;
  complete?: boolean;
  tone?: 'light' | 'shell';
}) {
  const r = 20;
  const c = 2 * Math.PI * r;
  const progress = complete || total <= 0 ? 1 : Math.min(1, (total - remaining) / total);
  const offset = c * (1 - progress);
  const reduced = prefersReducedMotion();
  const [animatedOffset, setAnimatedOffset] = useState(c);
  const mounted = useRef(false);

  useEffect(() => {
    if (reduced) {
      setAnimatedOffset(offset);
      return;
    }
    if (!mounted.current) {
      mounted.current = true;
      const id = requestAnimationFrame(() => setAnimatedOffset(offset));
      return () => cancelAnimationFrame(id);
    }
    setAnimatedOffset(offset);
  }, [offset, reduced]);

  const shell = tone === 'shell';

  return (
    <div
      className="relative size-14 flex-shrink-0"
      role="img"
      aria-label={`${remaining} tâche${remaining > 1 ? 's' : ''} restante${remaining > 1 ? 's' : ''} sur ${total}`}
    >
      <svg viewBox="0 0 48 48" className="size-14 -rotate-90" aria-hidden>
        <circle
          cx="24"
          cy="24"
          r={r}
          fill="none"
          stroke={shell ? 'rgba(255,255,255,0.22)' : FIELD.ardoisePastel}
          strokeWidth="4"
        />
        <circle
          cx="24"
          cy="24"
          r={r}
          fill="none"
          stroke={complete ? FIELD.vert : shell ? FIELD.orange : FIELD.vert}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={animatedOffset}
          style={{
            transition: reduced ? undefined : 'stroke-dashoffset 400ms ease-out',
          }}
        />
      </svg>
      <span
        className={`absolute inset-0 flex items-center justify-center font-semibold tabular-nums ${
          shell ? 'text-white' : 'text-text-strong'
        }`}
        style={{ fontSize: 16 }}
        aria-hidden
      >
        {remaining}
      </span>
    </div>
  );
}
