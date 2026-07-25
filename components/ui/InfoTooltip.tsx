'use client';

import { CircleHelp } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { createPortal } from 'react-dom';

export type InfoTooltipPlacement = 'top-start' | 'top-end' | 'left' | 'right';

const VIEWPORT_PAD = 12;
const GAP = 8;
const MAX_WIDTH = 280;

interface InfoTooltipProps {
  content: string;
  placement?: InfoTooltipPlacement;
  className?: string;
  iconSize?: number;
}

type Coords = { top: number; left: number };

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function computePosition(
  trigger: DOMRect,
  tip: DOMRect,
  placement: InfoTooltipPlacement,
): Coords {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const maxLeft = vw - tip.width - VIEWPORT_PAD;
  const maxTop = vh - tip.height - VIEWPORT_PAD;

  let top = 0;
  let left = 0;

  switch (placement) {
    case 'top-start':
      top = trigger.top - tip.height - GAP;
      left = trigger.left;
      break;
    case 'top-end':
      top = trigger.top - tip.height - GAP;
      left = trigger.right - tip.width;
      break;
    case 'left':
      top = trigger.top + trigger.height / 2 - tip.height / 2;
      left = trigger.left - tip.width - GAP;
      break;
    case 'right':
      top = trigger.top + trigger.height / 2 - tip.height / 2;
      left = trigger.right + GAP;
      break;
  }

  // Si trop haut : bascule sous le déclencheur.
  if (top < VIEWPORT_PAD && (placement === 'top-start' || placement === 'top-end')) {
    top = trigger.bottom + GAP;
  }

  // Si trop à gauche en placement "left" : bascule à droite.
  if (left < VIEWPORT_PAD && placement === 'left') {
    left = trigger.right + GAP;
  }

  // Si trop à droite en placement "right" : bascule à gauche.
  if (left > maxLeft && placement === 'right') {
    left = trigger.left - tip.width - GAP;
  }

  return {
    top: clamp(top, VIEWPORT_PAD, Math.max(VIEWPORT_PAD, maxTop)),
    left: clamp(left, VIEWPORT_PAD, Math.max(VIEWPORT_PAD, maxLeft)),
  };
}

export default function InfoTooltip({
  content,
  placement = 'top-start',
  className = '',
  iconSize = 14,
}: InfoTooltipProps) {
  const tooltipId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const tipRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState<Coords | null>(null);

  useEffect(() => setMounted(true), []);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    const tip = tipRef.current;
    if (!trigger || !tip) return;
    setCoords(computePosition(trigger.getBoundingClientRect(), tip.getBoundingClientRect(), placement));
  }, [placement]);

  useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }
    updatePosition();
  }, [open, content, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const onReposition = () => updatePosition();
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);
    return () => {
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
    };
  }, [open, updatePosition]);

  // Fermer au tap/clic extérieur (mobile + drawer).
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (tipRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const tipStyle: CSSProperties = {
    position: 'fixed',
    top: coords?.top ?? 0,
    left: coords?.left ?? 0,
    maxWidth: MAX_WIDTH,
    visibility: coords ? 'visible' : 'hidden',
    zIndex: 100,
  };

  const tooltip =
    mounted && open
      ? createPortal(
          <span
            ref={tipRef}
            id={tooltipId}
            role="tooltip"
            className="pointer-events-none w-max rounded-xl bg-ink px-3 py-2.5 text-left text-[11px] font-normal leading-snug text-white shadow-lg"
            style={tipStyle}
          >
            {content}
          </span>,
          document.body,
        )
      : null;

  return (
    <span className={`relative inline-flex shrink-0 align-middle ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        className="inline-flex rounded-full text-mute/80 transition-colors hover:text-mute focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
        aria-describedby={open ? tooltipId : undefined}
        aria-expanded={open}
        tabIndex={0}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={(e) => {
          e.stopPropagation();
          // Desktop : hover suffit. Mobile : tap pour ouvrir / fermer.
          if (typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches) {
            setOpen((prev) => !prev);
          }
        }}
      >
        <CircleHelp size={iconSize} strokeWidth={2} aria-hidden />
        <span className="sr-only">Plus d&apos;informations</span>
      </button>
      {tooltip}
    </span>
  );
}
