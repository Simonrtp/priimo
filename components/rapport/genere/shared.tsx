import type { ReactNode } from 'react';
import { ATTRIBUTION_IGN, positionDansCarte, urlCarteIgn } from '@/lib/rapport/genere/carte-ign';
import { DPE_PALETTE, parseDpeLetter } from '@/lib/carte/dpe-public';

export function TitrePage({ children, accent }: { children: string; accent: string }) {
  return (
    <h2 className="text-balance font-display text-[22px] font-semibold tracking-tight" style={{ color: accent }}>
      {children}
    </h2>
  );
}

export function Encadre({ children }: { children: ReactNode }) {
  return (
    <p className="text-pretty rounded-clay border border-black/[0.06] bg-white/80 px-3 py-2 text-[12.5px] leading-relaxed text-text">
      {children}
    </p>
  );
}

export function Fait({ label, valeur }: { label: string; valeur: string }) {
  return (
    <div>
      <p className="text-[10.5px] uppercase tracking-wide text-text-muted">{label}</p>
      <p className="mt-0.5 text-[13.5px] font-medium tabular-nums text-text-strong">{valeur}</p>
    </div>
  );
}

export function EtiquetteDpe({ lettre }: { lettre: string }) {
  const parsed = parseDpeLetter(lettre);
  if (!parsed) return null;
  return (
    <span
      className="inline-flex size-9 items-center justify-center text-[16px] font-bold text-white"
      style={{ backgroundColor: DPE_PALETTE[parsed] }}
      aria-label={`DPE ${parsed}`}
    >
      {parsed}
    </span>
  );
}

export function CarteIgn({
  latitude,
  longitude,
  spanM,
  couche,
  points,
}: {
  latitude: number;
  longitude: number;
  spanM?: number;
  couche?: 'plan' | 'cadastre';
  points?: Array<{ lat: number; lng: number; label: string }>;
}) {
  const span = spanM ?? 800;
  const src = urlCarteIgn({ latitude, longitude, spanM: span, couche, width: 720, height: 360 });
  return (
    <figure className="relative overflow-hidden rounded-clay bg-white">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className="h-full w-full object-cover" />
      {points?.map((p) => {
        const pos = positionDansCarte(p.lat, p.lng, { latitude, longitude }, span);
        if (!pos) return null;
        return (
          <span
            key={p.label}
            className="absolute flex size-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[#1A1714] text-[10px] font-semibold text-white"
            style={{ left: `${pos.x * 100}%`, top: `${pos.y * 100}%` }}
          >
            {p.label}
          </span>
        );
      })}
      <figcaption className="absolute bottom-1 right-2 text-[9px] text-black/55">{ATTRIBUTION_IGN}</figcaption>
    </figure>
  );
}

export function GraphiqueBarres({
  valeurs,
  accent,
  format,
}: {
  valeurs: Array<{ label: string; valeur: number }>;
  accent: string;
  format: (n: number) => string;
}) {
  if (valeurs.length === 0) return null;
  const max = Math.max(...valeurs.map((v) => v.valeur));
  if (max <= 0) return null;
  const w = 320;
  const h = 120;
  const gap = 8;
  const barW = (w - gap * (valeurs.length + 1)) / valeurs.length;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-28 w-full" role="img" aria-label="Graphique">
      {valeurs.map((v, i) => {
        const bh = (v.valeur / max) * 88;
        const x = gap + i * (barW + gap);
        return (
          <g key={v.label}>
            <rect x={x} y={96 - bh} width={barW} height={bh} fill={accent} />
            <text x={x + barW / 2} y={110} textAnchor="middle" fontSize="8" fill="#5c5854">
              {v.label}
            </text>
            <text x={x + barW / 2} y={92 - bh} textAnchor="middle" fontSize="8" fill="#1A1714">
              {format(v.valeur)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function NuagePoints({
  points,
  bien,
  accent,
}: {
  points: Array<{ x: number; y: number }>;
  bien: { x: number; y: number } | null;
  accent: string;
}) {
  if (points.length === 0 && !bien) return null;
  const xs = [...points.map((p) => p.x), bien?.x ?? 0];
  const ys = [...points.map((p) => p.y), bien?.y ?? 0];
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const dx = maxX - minX || 1;
  const dy = maxY - minY || 1;
  const w = 320;
  const h = 140;
  const px = (x: number) => 16 + ((x - minX) / dx) * (w - 32);
  const py = (y: number) => h - 16 - ((y - minY) / dy) * (h - 32);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-36 w-full" role="img" aria-label="Nuage surface et prix">
      {points.map((p, i) => (
        <circle key={i} cx={px(p.x)} cy={py(p.y)} r={3} fill="#8a8680" />
      ))}
      {bien ? <circle cx={px(bien.x)} cy={py(bien.y)} r={5.5} fill={accent} /> : null}
    </svg>
  );
}
