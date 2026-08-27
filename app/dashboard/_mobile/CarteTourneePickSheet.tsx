'use client';

import { Check, X } from 'lucide-react';
import type { CarteStopCandidate } from '@/lib/carte/carte-tournee';
import type { SortieStop } from '@/lib/today/sortie';
import { FIELD, formatDistance } from '@/lib/today/field';
import { armPointerShield } from '@/lib/ui/pointer-guard';

function StopRow({
  stop,
  checked,
  onToggle,
  badge,
}: {
  stop: SortieStop;
  checked: boolean;
  onToggle: () => void;
  badge?: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="app-press flex min-h-[52px] w-full items-center gap-3 rounded-2xl px-3 text-left"
    >
      <span
        className="flex size-6 flex-shrink-0 items-center justify-center rounded-md border-2"
        style={{
          borderColor: checked ? FIELD.orange : 'rgba(0,0,0,0.15)',
          backgroundColor: checked ? FIELD.orange : 'transparent',
        }}
        aria-hidden
      >
        {checked ? <Check size={14} strokeWidth={3} className="text-white" /> : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium text-text-strong">{stop.address}</span>
        <span className="block text-[12.5px] text-text-muted">
          Score {Math.round(stop.score)}
          {badge ? ` · ${badge}` : ''}
        </span>
      </span>
    </button>
  );
}

export default function CarteTourneePickSheet({
  mine,
  pool,
  manual,
  selectedKeys,
  onToggle,
  distanceM,
  onLaunch,
  onClose,
}: {
  mine: readonly CarteStopCandidate[];
  pool: readonly CarteStopCandidate[];
  manual: readonly SortieStop[];
  selectedKeys: ReadonlySet<string>;
  onToggle: (key: string) => void;
  distanceM: number;
  onLaunch: () => void;
  onClose: () => void;
}) {
  const count = selectedKeys.size;
  const canLaunch = count > 0;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[70]">
      <div
        className="pointer-events-auto rounded-t-[24px] bg-surface shadow-[0_-12px_40px_rgba(15,23,34,0.22)]"
        style={{ paddingBottom: 'calc(12px + var(--field-nav-height))' }}
      >
        <div className="flex items-center justify-between px-5 pb-2 pt-4">
          <div>
            <p className="font-semibold text-text-strong" style={{ fontSize: 17 }}>
              Choisir les adresses
            </p>
            <p className="mt-0.5 text-[12.5px] text-text-muted">
              Touchez la carte pour en ajouter · {count} sélectionnée{count > 1 ? 's' : ''}
              {count > 1 ? ` · ${formatDistance(distanceM)}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              armPointerShield();
              onClose();
            }}
            aria-label="Fermer"
            className="app-press flex size-11 items-center justify-center rounded-full text-text-muted"
          >
            <X size={20} strokeWidth={2} aria-hidden />
          </button>
        </div>

        <div className="max-h-[min(42dvh,360px)] overflow-y-auto px-3 pb-3">
          {mine.length > 0 ? (
            <section className="mb-3">
              <p className="px-2 pb-1 text-[12px] font-semibold uppercase tracking-wide text-text-muted">
                Mes adresses
              </p>
              <ul className="flex flex-col gap-0.5">
                {mine.map((stop) => (
                  <li key={stop.key}>
                    <StopRow
                      stop={stop}
                      checked={selectedKeys.has(stop.key)}
                      onToggle={() => onToggle(stop.key)}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {pool.length > 0 ? (
            <section className="mb-3">
              <p className="px-2 pb-1 text-[12px] font-semibold uppercase tracking-wide text-text-muted">
                Proposées
              </p>
              <ul className="flex flex-col gap-0.5">
                {pool.map((stop) => (
                  <li key={stop.key}>
                    <StopRow
                      stop={stop}
                      checked={selectedKeys.has(stop.key)}
                      onToggle={() => onToggle(stop.key)}
                      badge="Agence"
                    />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {manual.length > 0 ? (
            <section>
              <p className="px-2 pb-1 text-[12px] font-semibold uppercase tracking-wide text-text-muted">
                Ajoutées sur la carte
              </p>
              <ul className="flex flex-col gap-0.5">
                {manual.map((stop) => (
                  <li key={stop.key}>
                    <StopRow
                      stop={stop}
                      checked={selectedKeys.has(stop.key)}
                      onToggle={() => onToggle(stop.key)}
                      badge="Manuel"
                    />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {mine.length === 0 && pool.length === 0 && manual.length === 0 ? (
            <p className="px-3 py-6 text-center text-[14px] text-text-muted">
              Aucune adresse disponible. Touchez un immeuble sur la carte.
            </p>
          ) : null}
        </div>

        <div className="border-t border-black/[0.06] px-4 pt-3">
          <button
            type="button"
            disabled={!canLaunch}
            onClick={onLaunch}
            className="flex min-h-[52px] w-full items-center justify-center rounded-2xl font-semibold text-white disabled:opacity-40"
            style={{ backgroundColor: FIELD.orange, fontSize: 16 }}
          >
            Lancer la tournée
          </button>
        </div>
      </div>
    </div>
  );
}
