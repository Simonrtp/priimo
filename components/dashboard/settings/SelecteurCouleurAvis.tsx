'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { hexVersHsv, hsvVersHex } from '@/lib/rapport/couleurs';

function huePur(h: number): string {
  return hsvVersHex(h, 1, 1);
}

export default function SelecteurCouleurAvis({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: readonly { hex: string; label: string }[];
  onChange: (hex: string) => void;
}) {
  const actuel = /^#[0-9A-Fa-f]{6}$/.test(value) ? value.toUpperCase() : '#000000';
  const hsv = hexVersHsv(actuel);
  const [ouvert, setOuvert] = useState(false);
  const [hex, setHex] = useState(actuel);
  const racine = useRef<HTMLDivElement>(null);
  const declencheur = useRef<HTMLButtonElement>(null);
  const titreId = useId();

  useEffect(() => {
    setHex(actuel);
  }, [actuel]);

  useEffect(() => {
    if (!ouvert) return;
    const onDown = (e: MouseEvent) => {
      if (!racine.current?.contains(e.target as Node)) setOuvert(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOuvert(false);
        declencheur.current?.focus();
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [ouvert]);

  function appliquer(h: number, s: number, v: number) {
    onChange(hsvVersHex(h, s, v));
  }

  function pointerSv(el: HTMLElement, clientX: number, clientY: number) {
    const box = el.getBoundingClientRect();
    const s = Math.min(1, Math.max(0, (clientX - box.left) / box.width));
    const v = Math.min(1, Math.max(0, 1 - (clientY - box.top) / box.height));
    appliquer(hsv.h, s, v);
  }

  return (
    <div ref={racine} className="relative min-w-0">
      <button
        ref={declencheur}
        type="button"
        id={id}
        aria-haspopup="dialog"
        aria-expanded={ouvert}
        aria-controls={`${id}-panneau`}
        onClick={() => setOuvert((o) => !o)}
        className="flex w-full min-w-[11.5rem] items-center gap-3 rounded-clay border border-black/[0.08] bg-surface py-1.5 pl-1.5 pr-3 text-left hover:bg-black/[0.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <span
          className="size-9 shrink-0 rounded-md border border-black/[0.06]"
          style={{ backgroundColor: actuel }}
          aria-hidden
        />
        <span className="min-w-0">
          <span className="block text-[12px] text-text-muted">{label}</span>
          <span className="block font-mono text-[13px] tabular-nums text-text-strong">{actuel}</span>
        </span>
      </button>

      {ouvert ? (
        <div
          id={`${id}-panneau`}
          role="dialog"
          aria-labelledby={titreId}
          className="absolute left-0 top-full z-30 mt-1.5 w-[16.5rem] rounded-clay border border-black/[0.08] bg-white p-3 shadow-clay"
        >
          <p id={titreId} className="sr-only">
            {label}
          </p>
          <div className="overflow-hidden rounded-md border border-black/[0.06]">
            <div className="h-10" style={{ backgroundColor: actuel }} aria-hidden />
            <div className="flex items-center justify-between gap-2 px-2.5 py-1.5">
              <label className="sr-only" htmlFor={`${id}-hex`}>
                Code hexadécimal
              </label>
              <input
                id={`${id}-hex`}
                value={hex}
                spellCheck={false}
                autoComplete="off"
                className="w-full bg-transparent font-mono text-[13px] uppercase tabular-nums text-text-strong outline-none"
                onChange={(e) => {
                  const brut = e.target.value.trim();
                  const suivant = (brut.startsWith('#') ? brut : `#${brut}`).toUpperCase();
                  setHex(suivant);
                  if (/^#[0-9A-Fa-f]{6}$/.test(suivant)) onChange(suivant);
                }}
              />
            </div>
          </div>

          <div
            role="slider"
            tabIndex={0}
            aria-label="Saturation et luminosité"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(hsv.s * 100)}
            aria-valuetext={`Saturation ${Math.round(hsv.s * 100)} %, luminosité ${Math.round(hsv.v * 100)} %`}
            className="relative mt-3 h-28 cursor-crosshair overflow-hidden rounded-md border border-black/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            style={{
              backgroundColor: huePur(hsv.h),
              backgroundImage:
                'linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent)',
            }}
            onPointerDown={(e) => {
              const el = e.currentTarget;
              el.setPointerCapture(e.pointerId);
              pointerSv(el, e.clientX, e.clientY);
            }}
            onPointerMove={(e) => {
              if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
              pointerSv(e.currentTarget, e.clientX, e.clientY);
            }}
            onKeyDown={(e) => {
              const pas = e.shiftKey ? 0.08 : 0.03;
              if (e.key === 'ArrowLeft') {
                e.preventDefault();
                appliquer(hsv.h, Math.max(0, hsv.s - pas), hsv.v);
              } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                appliquer(hsv.h, Math.min(1, hsv.s + pas), hsv.v);
              } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                appliquer(hsv.h, hsv.s, Math.max(0, hsv.v - pas));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                appliquer(hsv.h, hsv.s, Math.min(1, hsv.v + pas));
              }
            }}
          >
            <span
              className="pointer-events-none absolute size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white"
              style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }}
              aria-hidden
            />
          </div>

          <label className="mt-2.5 block">
            <span className="sr-only">Teinte</span>
            <input
              type="range"
              min={0}
              max={360}
              value={Math.round(hsv.h)}
              aria-valuetext={`${Math.round(hsv.h)} degrés`}
              className="h-3 w-full cursor-pointer appearance-none rounded-full border border-black/[0.06]"
              style={{
                background:
                  'linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)',
              }}
              onChange={(e) => appliquer(Number(e.target.value), hsv.s, hsv.v)}
            />
          </label>

          <ul className="mt-3 grid grid-cols-7 gap-1.5">
            {options.map((c) => {
              const selected = c.hex.toUpperCase() === actuel;
              return (
                <li key={c.hex}>
                  <button
                    type="button"
                    aria-label={c.label}
                    aria-pressed={selected}
                    title={c.label}
                    onClick={() => onChange(c.hex.toUpperCase())}
                    className="relative block size-6 rounded-md border border-black/[0.08] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    style={{ backgroundColor: c.hex }}
                  >
                    {selected ? (
                      <span className="absolute inset-0 rounded-md ring-2 ring-[#0A0D11] ring-offset-1" aria-hidden />
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
