'use client';

import type { CorrectionLine } from '@/lib/estimation/corrections';

function formatEuroPlain(n: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n);
}

function formatSigned(n: number): string {
  const abs = formatEuroPlain(Math.abs(n));
  if (n > 0) return `+${abs}`;
  if (n < 0) return `−${abs}`;
  return abs;
}

/**
 * Détail du calcul, ligne à ligne.
 * Au survol : sur combien de ventes le coefficient a été établi.
 */
export default function DetailCalcul({
  lines,
  low,
  high,
}: {
  lines: CorrectionLine[];
  low: number | null;
  high: number | null;
}) {
  const detail = lines.filter((l) => l.kind !== 'total');
  const total = lines.find((l) => l.kind === 'total');

  return (
    <div className="rounded-clay border border-black/[0.06] bg-surface px-4 py-3 shadow-clay-sm">
      <h3 className="mb-3 text-[14px] font-semibold text-ink">Détail du calcul</h3>
      <ul className="flex flex-col gap-1.5">
        {detail.map((line) => (
          <li
            key={line.id}
            className="group relative flex items-baseline justify-between gap-3 text-[13px]"
            title={
              line.sampleSize != null
                ? `Établi sur ${line.sampleSize} vente${line.sampleSize > 1 ? 's' : ''} réelle${line.sampleSize > 1 ? 's' : ''}`
                : 'Ajustement forfaitaire'
            }
          >
            <span className="min-w-0 text-pretty text-text-muted">{line.label}</span>
            <span className="shrink-0 tabular-nums font-medium text-ink">
              {line.kind === 'base' ? formatEuroPlain(line.amountEur) : formatSigned(line.amountEur)}
            </span>
            {line.sampleSize != null ? (
              <span className="pointer-events-none absolute bottom-full left-0 z-10 mb-1 hidden max-w-xs rounded-md bg-ink px-2 py-1 text-[11px] text-white group-hover:block">
                Établi sur {line.sampleSize} vente{line.sampleSize > 1 ? 's' : ''} réelle
                {line.sampleSize > 1 ? 's' : ''}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
      <div className="mt-3 border-t border-black/[0.08] pt-3">
        {total ? (
          <div className="flex items-baseline justify-between gap-3 text-[14px] font-semibold text-ink">
            <span>{total.label}</span>
            <span className="tabular-nums">{formatEuroPlain(total.amountEur)}</span>
          </div>
        ) : null}
        {low != null && high != null ? (
          <div className="mt-1.5 flex items-baseline justify-between gap-3 text-[13px] text-text-muted">
            <span>Fourchette</span>
            <span className="tabular-nums">
              {formatEuroPlain(low)} – {formatEuroPlain(high)}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
