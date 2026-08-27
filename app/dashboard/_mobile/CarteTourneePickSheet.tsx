'use client';

import { useMemo, useState } from 'react';
import { Check, ChevronDown, ChevronUp, Search, X } from 'lucide-react';
import AddressAutocomplete, { type SelectedAddress } from '@/components/AddressAutocomplete';
import type { BatchScope, LatestBatchCandidates } from '@/lib/carte/carte-tournee';
import { MAX_SORTIE_STOPS } from '@/lib/today/sortie';
import type { SortieStop } from '@/lib/today/sortie';
import { FIELD, formatDistance } from '@/lib/today/field';
import { armPointerShield } from '@/lib/ui/pointer-guard';

const PREVIEW_LIMIT = 12;

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
      className="app-press flex min-h-[52px] w-full items-center gap-3 rounded-2xl px-3 text-left transition-colors hover:bg-black/[0.03]"
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

function ScopeChip({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="app-press min-h-[40px] flex-1 rounded-xl px-3 text-[13.5px] font-semibold transition-colors"
      style={{
        backgroundColor: active ? FIELD.orange : 'rgba(0,0,0,0.05)',
        color: active ? '#fff' : FIELD.ardoise,
      }}
    >
      {label}
      <span className="ml-1 tabular-nums opacity-80">({count})</span>
    </button>
  );
}

export default function CarteTourneePickSheet({
  batch,
  batchScope,
  onBatchScopeChange,
  manual,
  selectedKeys,
  onToggle,
  onAddAddress,
  postcodeFilter,
  distanceM,
  onContinue,
  onClose,
}: {
  batch: LatestBatchCandidates;
  batchScope: BatchScope;
  onBatchScopeChange: (scope: BatchScope) => void;
  manual: readonly SortieStop[];
  selectedKeys: ReadonlySet<string>;
  onToggle: (key: string) => void;
  onAddAddress: (address: SelectedAddress) => void;
  postcodeFilter?: string;
  distanceM: number;
  onContinue: () => void;
  onClose: () => void;
}) {
  const [listExpanded, setListExpanded] = useState(false);
  const [filter, setFilter] = useState('');

  const scopeStops = batchScope === 'mine' ? batch.mine : batch.all;
  const batchSelectedCount = scopeStops.filter((s) => selectedKeys.has(s.key)).length;

  const filteredScope = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return scopeStops;
    return scopeStops.filter((s) => s.address.toLowerCase().includes(q));
  }, [scopeStops, filter]);

  const previewStops = listExpanded ? filteredScope.slice(0, 50) : filteredScope.slice(0, PREVIEW_LIMIT);
  const hasMore = filteredScope.length > previewStops.length;

  const count = selectedKeys.size;
  const canContinue = count > 0;

  function handleAddAddress(data: SelectedAddress | null) {
    if (!data) return;
    onAddAddress(data);
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[70] px-4">
      <div
        className="pointer-events-auto overflow-hidden rounded-[24px] bg-surface shadow-[0_-12px_40px_rgba(15,23,34,0.22)] ring-1 ring-black/[0.06]"
        style={{ marginBottom: 'calc(12px + var(--field-nav-height))' }}
      >
        <div className="flex items-start justify-between gap-3 px-5 pb-2 pt-4">
          <div className="min-w-0">
            <p className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: FIELD.ardoise }}>
              Tournée
            </p>
            <p className="font-semibold text-text-strong" style={{ fontSize: 18 }}>
              Où prospecter ?
            </p>
            <p className="mt-0.5 text-[12.5px] text-text-muted">
              {count} sélectionnée{count > 1 ? 's' : ''}
              {count > 1 ? ` · ${formatDistance(distanceM)}` : ''}
              {' · '}max {MAX_SORTIE_STOPS} par tournée
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              armPointerShield();
              onClose();
            }}
            aria-label="Fermer"
            className="app-press flex size-11 flex-shrink-0 items-center justify-center rounded-full bg-black/[0.05] text-text-muted"
          >
            <X size={20} strokeWidth={2} aria-hidden />
          </button>
        </div>

        <div className="max-h-[min(42dvh,360px)] overflow-y-auto px-3 pb-3">
          {batch.all.length > 0 ? (
            <section className="mb-4">
              <p className="px-2 pb-2 text-[12px] font-semibold uppercase tracking-wide text-text-muted">
                {batch.label || 'Liste du lundi'}
              </p>
              <div className="flex gap-2 px-1 pb-3">
                <ScopeChip
                  active={batchScope === 'all'}
                  label="Toutes"
                  count={batch.all.length}
                  onClick={() => onBatchScopeChange('all')}
                />
                <ScopeChip
                  active={batchScope === 'mine'}
                  label="Mes assignées"
                  count={batch.mine.length}
                  onClick={() => onBatchScopeChange('mine')}
                />
              </div>
              <p className="px-2 pb-2 text-[12.5px] leading-snug text-text-muted">
                {batchSelectedCount > 0
                  ? `${batchSelectedCount} adresse${batchSelectedCount > 1 ? 's' : ''} du lot sélectionnée${batchSelectedCount > 1 ? 's' : ''} (top scores, max ${MAX_SORTIE_STOPS}).`
                  : `Choisissez un périmètre — les ${MAX_SORTIE_STOPS} meilleures adresses seront proposées.`}
              </p>

              {scopeStops.length > PREVIEW_LIMIT ? (
                <div className="relative mx-1 mb-2">
                  <Search
                    size={16}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
                    aria-hidden
                  />
                  <input
                    type="search"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    placeholder="Filtrer dans le lot…"
                    className="w-full rounded-xl border border-black/[0.08] bg-black/[0.02] py-2.5 pl-9 pr-3 text-[14px] text-text-strong outline-none focus:border-accent"
                  />
                </div>
              ) : null}

              <ul className="flex flex-col gap-0.5">
                {previewStops.map((stop) => (
                  <li key={stop.key}>
                    <StopRow
                      stop={stop}
                      checked={selectedKeys.has(stop.key)}
                      onToggle={() => onToggle(stop.key)}
                      badge={batchScope === 'mine' ? 'Assignée' : 'Lot'}
                    />
                  </li>
                ))}
              </ul>

              {scopeStops.length > PREVIEW_LIMIT ? (
                <button
                  type="button"
                  onClick={() => setListExpanded((v) => !v)}
                  className="app-press mx-1 mt-1 flex min-h-[40px] w-[calc(100%-8px)] items-center justify-center gap-1 rounded-xl text-[13px] font-semibold text-text-muted"
                >
                  {listExpanded ? (
                    <>
                      <ChevronUp size={16} aria-hidden />
                      Réduire la liste
                    </>
                  ) : hasMore ? (
                    <>
                      <ChevronDown size={16} aria-hidden />
                      Voir {Math.min(50, filteredScope.length) - PREVIEW_LIMIT} adresses de plus
                    </>
                  ) : (
                    <>
                      <ChevronDown size={16} aria-hidden />
                      Voir toute la liste
                    </>
                  )}
                </button>
              ) : null}
            </section>
          ) : (
            <p className="px-3 py-2 text-[14px] text-text-muted">
              Pas de lot récent — touchez la carte ou cherchez une adresse ci-dessous.
            </p>
          )}

          <section className="mb-3">
            <p className="px-2 pb-2 text-[12px] font-semibold uppercase tracking-wide text-text-muted">
              Ajouter une adresse
            </p>
            <div className="px-1">
              <AddressAutocomplete
                placeholder="Rechercher une adresse…"
                postcodeFilter={postcodeFilter}
                onChange={handleAddAddress}
                inputClassName="w-full rounded-xl border border-black/[0.08] bg-black/[0.02] py-3 pl-10 pr-3 text-[15px] text-text-strong outline-none focus:border-accent"
                aria-label="Rechercher une adresse à ajouter"
              />
            </div>
          </section>

          {manual.length > 0 ? (
            <section>
              <p className="px-2 pb-1 text-[12px] font-semibold uppercase tracking-wide text-text-muted">
                Ajoutées ({manual.length})
              </p>
              <ul className="flex flex-col gap-0.5">
                {manual.map((stop) => (
                  <li key={stop.key}>
                    <StopRow
                      stop={stop}
                      checked={selectedKeys.has(stop.key)}
                      onToggle={() => onToggle(stop.key)}
                      badge="Manuelle"
                    />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <div className="border-t border-black/[0.06] px-4 py-3">
          <button
            type="button"
            disabled={!canContinue}
            onClick={onContinue}
            className="flex min-h-[52px] w-full items-center justify-center rounded-2xl font-semibold text-white disabled:opacity-40"
            style={{ backgroundColor: FIELD.orange, fontSize: 16 }}
          >
            Continuer
          </button>
        </div>
      </div>
    </div>
  );
}
