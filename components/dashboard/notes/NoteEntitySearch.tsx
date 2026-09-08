'use client';

import { useEffect, useId, useState } from 'react';
import type { NoteLienEntite } from '@/types/contact';
import type { SearchHit } from '@/lib/assistant/search';
import { SEARCH_MIN_LEN } from '@/lib/assistant/search';
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
};

export type NoteLinkPick = {
  entiteType: NoteLienEntite;
  entiteId: string;
  label: string;
  subtitle: string | null;
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

  useEffect(() => {
    const q = query.trim();
    if (q.length < SEARCH_MIN_LEN) {
      setHits([]);
      return;
    }
    const t = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch(`/api/assistant/search?q=${encodeURIComponent(q)}`);
          const data = (await res.json()) as { hits?: SearchHit[] };
          const next = (data.hits ?? []).filter((h) => KIND_TO_ENTITE[h.kind]);
          setHits(next.slice(0, 8));
        } catch {
          setHits([]);
        }
      })();
    }, 220);
    return () => window.clearTimeout(t);
  }, [query]);

  const visible = hits.filter((h) => !excludeIds?.has(`${KIND_TO_ENTITE[h.kind]}:${h.id}`));

  return (
    <div>
      <label htmlFor={inputId} className="mb-1.5 block font-medium text-text-muted" style={{ fontSize: 12.5 }}>
        Rattacher à un contact, un bien, un prospect
      </label>
      <TextInput
        id={inputId}
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Tapez un nom…"
        autoComplete="off"
        disabled={disabled}
        aria-controls={listId}
        aria-expanded={visible.length > 0}
      />
      {visible.length > 0 ? (
        <ul
          id={listId}
          role="listbox"
          aria-label="Résultats"
          className="mt-2 overflow-hidden rounded-xl border border-black/[0.08]"
        >
          {visible.map((hit) => {
            const entiteType = KIND_TO_ENTITE[hit.kind];
            if (!entiteType) return null;
            return (
              <li key={`${hit.kind}-${hit.id}`} role="option">
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    onPick({
                      entiteType,
                      entiteId: hit.id,
                      label: hit.label,
                      subtitle: hit.subtitle || KIND_LABEL[hit.kind] || null,
                    });
                    setQuery('');
                    setHits([]);
                  }}
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
        </ul>
      ) : null}
    </div>
  );
}
