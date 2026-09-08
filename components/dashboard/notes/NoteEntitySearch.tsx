'use client';

import { useEffect, useId, useState } from 'react';
import type { NoteLienEntite } from '@/types/contact';
import type { SearchHit } from '@/lib/assistant/search';
import { SEARCH_MIN_LEN } from '@/lib/assistant/search';
import { normalizeTexte } from '@/lib/assistant/normalize';
import { banFeatureToSelectedAddress, searchBanAddresses } from '@/lib/ban';
import { TextInput } from '@/components/dashboard/workspace/Field';

const KIND_TO_ENTITE: Partial<Record<SearchHit['kind'], NoteLienEntite>> = {
  contact: 'contact',
  bien: 'bien',
  lead: 'lead',
};

const KIND_LABEL: Record<string, string> = {
  contact: 'Contact',
  bien: 'Bien',
  lead: 'Prospect',
  immeuble: 'Nouvel immeuble',
};

const BAN_MIN_LEN = 3;

export type NoteLinkPick = {
  entiteType: NoteLienEntite;
  entiteId: string;
  label: string;
  subtitle: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

type BanHit = {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
};

export default function NoteEntitySearch({
  onPick,
  disabled = false,
  excludeIds,
}: {
  onPick: (pick: NoteLinkPick) => void;
  disabled?: boolean;
  excludeIds?: ReadonlySet<string>;
}) {
  const inputId = useId();
  const listId = useId();
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [banHits, setBanHits] = useState<BanHit[]>([]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < SEARCH_MIN_LEN) {
      setHits([]);
      setBanHits([]);
      return;
    }
    const ac = new AbortController();
    const t = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch(`/api/assistant/search?q=${encodeURIComponent(q)}`, {
            signal: ac.signal,
          });
          const data = (await res.json()) as { hits?: SearchHit[] };
          const next = (data.hits ?? []).filter((h) => KIND_TO_ENTITE[h.kind]);
          setHits(next.slice(0, 8));
        } catch {
          if (!ac.signal.aborted) setHits([]);
        }
      })();
      if (q.length < BAN_MIN_LEN) {
        setBanHits([]);
        return;
      }
      void (async () => {
        try {
          const features = await searchBanAddresses(q, 5, undefined, ac.signal);
          setBanHits(
            features.flatMap((feature) => {
              const selected = banFeatureToSelectedAddress(feature);
              if (!selected.id) return [];
              return [
                {
                  id: selected.id,
                  label: selected.label,
                  latitude: selected.latitude,
                  longitude: selected.longitude,
                },
              ];
            }),
          );
        } catch {
          if (!ac.signal.aborted) setBanHits([]);
        }
      })();
    }, 220);
    return () => {
      window.clearTimeout(t);
      ac.abort();
    };
  }, [query]);

  const visibleAgency = hits.filter((h) => !excludeIds?.has(`${KIND_TO_ENTITE[h.kind]}:${h.id}`));
  const knownAddresses = new Set(
    hits.flatMap((h) => [normalizeTexte(h.label), normalizeTexte(h.subtitle)].filter(Boolean)),
  );
  const visibleBan = banHits.filter((b) => {
    if (excludeIds?.has(`immeuble:${b.id}`)) return false;
    return !knownAddresses.has(normalizeTexte(b.label));
  });
  const hasResults = visibleAgency.length > 0 || visibleBan.length > 0;

  function pickAgency(hit: SearchHit) {
    const entiteType = KIND_TO_ENTITE[hit.kind];
    if (!entiteType) return;
    onPick({
      entiteType,
      entiteId: hit.id,
      label: hit.label,
      subtitle: hit.subtitle || KIND_LABEL[hit.kind] || null,
    });
    setQuery('');
    setHits([]);
    setBanHits([]);
  }

  function pickBan(hit: BanHit) {
    onPick({
      entiteType: 'immeuble',
      entiteId: hit.id,
      label: hit.label,
      subtitle: KIND_LABEL.immeuble,
      latitude: hit.latitude,
      longitude: hit.longitude,
    });
    setQuery('');
    setHits([]);
    setBanHits([]);
  }

  return (
    <div>
      <label htmlFor={inputId} className="mb-1.5 block font-medium text-text-muted" style={{ fontSize: 12.5 }}>
        Rattacher à un contact, un bien, un prospect ou un immeuble
      </label>
      <TextInput
        id={inputId}
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Tapez un nom, une adresse…"
        autoComplete="off"
        disabled={disabled}
        aria-controls={listId}
        aria-expanded={hasResults}
      />
      {hasResults ? (
        <ul
          id={listId}
          role="listbox"
          aria-label="Résultats"
          className="mt-2 overflow-hidden rounded-xl border border-black/[0.08]"
        >
          {visibleAgency.map((hit) => {
            const entiteType = KIND_TO_ENTITE[hit.kind];
            if (!entiteType) return null;
            return (
              <li key={`${hit.kind}-${hit.id}`} role="option">
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => pickAgency(hit)}
                  className="flex w-full flex-col items-start px-3 py-2.5 text-left transition-colors hover:bg-black/[0.03] focus-visible:bg-black/[0.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent disabled:opacity-50"
                >
                  <span className="text-[13.5px] font-medium text-text">{hit.label}</span>
                  <span className="text-[12px] text-text-muted">
                    {KIND_LABEL[hit.kind]}
                    {hit.subtitle ? ` · ${hit.subtitle}` : ''}
                  </span>
                </button>
              </li>
            );
          })}
          {visibleBan.map((hit) => (
            <li key={`immeuble-${hit.id}`} role="option">
              <button
                type="button"
                disabled={disabled}
                onClick={() => pickBan(hit)}
                className="flex w-full flex-col items-start px-3 py-2.5 text-left transition-colors hover:bg-black/[0.03] focus-visible:bg-black/[0.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent disabled:opacity-50"
              >
                <span className="text-[13.5px] font-medium text-text">{hit.label}</span>
                <span className="text-[12px] text-text-muted">{KIND_LABEL.immeuble}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
