'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { PASTILLE_TRACK, pastilleClass, pastilleGlissanteClass } from '@/components/ui/pastille-classes';

export { PASTILLE_TRACK, pastilleClass, pastilleGlissanteClass } from '@/components/ui/pastille-classes';

type Mesure = { x: number; y: number; w: number; h: number };

const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/**
 * Piste de pastilles dont le fond actif glisse d'un bouton à l'autre.
 * Chaque bouton enfant porte `data-pastille-active={actif || undefined}`.
 */
export function PistePastilles({
  children,
  className = PASTILLE_TRACK,
  curseurClassName = 'bg-[#1A2A56] shadow-[0_6px_16px_-4px_rgba(26,42,86,0.45)]',
  role,
  label,
  busy,
}: {
  children: ReactNode;
  className?: string;
  curseurClassName?: string;
  role?: 'group' | 'tablist' | 'navigation';
  label?: string;
  busy?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [mesure, setMesure] = useState<Mesure | null>(null);
  const [anime, setAnime] = useState(false);
  const deja = useRef(false);

  const lire = useCallback(() => {
    const root = ref.current;
    if (!root) return;
    const el = root.querySelector<HTMLElement>(
      '[data-pastille-active="true"], [aria-selected="true"], [aria-pressed="true"]',
    );
    if (!el) {
      setMesure(null);
      return;
    }
    const suivante = { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight };
    // Même place : on garde l'objet, sinon chaque rendu en relancerait un autre, sans fin.
    setMesure((avant) =>
      avant &&
      avant.x === suivante.x &&
      avant.y === suivante.y &&
      avant.w === suivante.w &&
      avant.h === suivante.h
        ? avant
        : suivante,
    );
    if (!deja.current) {
      deja.current = true;
      requestAnimationFrame(() => setAnime(true));
    }
  }, []);

  // Après chaque rendu : la pastille active a pu changer.
  useIsoLayoutEffect(() => {
    lire();
  });

  // Une largeur qui change (texte, fenêtre) déplace aussi la pastille.
  useEffect(() => {
    const root = ref.current;
    if (!root || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(lire);
    ro.observe(root);
    return () => ro.disconnect();
  }, [lire]);

  return (
    <div
      ref={ref}
      role={role === 'navigation' ? undefined : role}
      aria-label={label}
      aria-busy={busy}
      className={`relative isolate ${className}`}
    >
      {mesure ? (
        <span
          aria-hidden
          style={{
            width: mesure.w,
            height: mesure.h,
            transform: `translate3d(${mesure.x}px, ${mesure.y}px, 0)`,
          }}
          className={`pointer-events-none absolute left-0 top-0 z-0 rounded-full ${curseurClassName} ${
            anime
              ? 'transition-[transform,width,height] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none'
              : ''
          }`}
        />
      ) : null}
      {children}
    </div>
  );
}

type Pastille<T extends string> = {
  id: T;
  label: ReactNode;
  title?: string;
};

export default function Pastilles<T extends string>({
  value,
  options,
  onChange,
  label,
  role = 'group',
  className = PASTILLE_TRACK,
  buttonClassName = '',
}: {
  value: T;
  options: readonly Pastille<T>[];
  onChange?: (id: T) => void;
  label: string;
  role?: 'group' | 'tablist';
  className?: string;
  buttonClassName?: string;
}) {
  const asTabs = role === 'tablist';

  return (
    <PistePastilles role={role} label={label} className={className}>
      {options.map((opt) => {
        const actif = opt.id === value;
        return (
          <button
            key={opt.id}
            type="button"
            role={asTabs ? 'tab' : undefined}
            aria-selected={asTabs ? actif : undefined}
            aria-pressed={asTabs ? undefined : actif}
            data-pastille-active={actif || undefined}
            title={opt.title}
            disabled={!onChange}
            onClick={() => onChange?.(opt.id)}
            className={`${pastilleGlissanteClass(actif)} ${buttonClassName}`}
          >
            {opt.label}
          </button>
        );
      })}
    </PistePastilles>
  );
}
