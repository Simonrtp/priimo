'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import type { NoteLienEntite } from '@/types/contact';
import { banFeatureToSelectedAddress, searchBanAddresses } from '@/lib/ban';
import {
  filtrerCatalogue,
  RATTACHER_CARTES,
  type RattacherItem,
  type RattacherKind,
} from '@/lib/notes/rattacher-catalogue';

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

const BAN_MIN_LEN = 3;

const PLACEHOLDER: Record<RattacherKind, string> = {
  contact: 'Rechercher un contact…',
  bien: 'Rechercher un bien…',
  lead: 'Rechercher un prospect…',
  immeuble: 'Rechercher une adresse…',
};

const LIBELLE_VIDE: Record<RattacherKind, string> = {
  contact: 'Aucun contact',
  bien: 'Aucun bien',
  lead: 'Aucun prospect',
  immeuble: 'Tapez une adresse pour rattacher un immeuble.',
};

export default function NoteEntitySearch({
  onPick,
  disabled = false,
  excludeIds,
  id,
  className = 'w-full max-w-sm',
}: {
  onPick: (pick: NoteLinkPick) => void;
  disabled?: boolean;
  excludeIds?: ReadonlySet<string>;
  id?: string;
  className?: string;
}) {
  const listId = useId();
  const [kind, setKind] = useState<RattacherKind>('contact');
  const [catalogue, setCatalogue] = useState<Record<'contact' | 'bien' | 'lead', RattacherItem[]>>({
    contact: [],
    bien: [],
    lead: [],
  });
  const [charge, setCharge] = useState(true);
  const [query, setQuery] = useState('');
  const [banHits, setBanHits] = useState<BanHit[]>([]);

  useEffect(() => {
    let cancel = false;
    void fetch('/api/dashboard/rattacher')
      .then((r) => r.json())
      .then((data: { contact?: RattacherItem[]; bien?: RattacherItem[]; lead?: RattacherItem[] }) => {
        if (cancel) return;
        setCatalogue({
          contact: data.contact ?? [],
          bien: data.bien ?? [],
          lead: data.lead ?? [],
        });
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancel) setCharge(false);
      });
    return () => {
      cancel = true;
    };
  }, []);

  useEffect(() => {
    if (kind !== 'immeuble') {
      setBanHits([]);
      return;
    }
    const q = query.trim();
    if (q.length < BAN_MIN_LEN) {
      setBanHits([]);
      return;
    }
    const ac = new AbortController();
    const t = window.setTimeout(() => {
      void searchBanAddresses(q, 8, undefined, ac.signal)
        .then((features) => {
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
        })
        .catch(() => {
          if (!ac.signal.aborted) setBanHits([]);
        });
    }, 220);
    return () => {
      window.clearTimeout(t);
      ac.abort();
    };
  }, [kind, query]);

  const tous = useMemo(() => {
    if (kind === 'immeuble') {
      return banHits
        .filter((b) => !excludeIds?.has(`immeuble:${b.id}`))
        .map((b) => ({
          id: b.id,
          kind: 'immeuble' as const,
          label: b.label,
          subtitle: 'Immeuble',
        }));
    }
    return catalogue[kind].filter((item) => !excludeIds?.has(`${item.kind}:${item.id}`));
  }, [banHits, catalogue, excludeIds, kind]);

  const filtres = useMemo(() => filtrerCatalogue(tous, query), [tous, query]);

  function pickItem(item: RattacherItem) {
    if (kind === 'immeuble') {
      const ban = banHits.find((b) => b.id === item.id);
      onPick({
        entiteType: 'immeuble',
        entiteId: item.id,
        label: item.label,
        subtitle: 'Immeuble',
        latitude: ban?.latitude,
        longitude: ban?.longitude,
      });
    } else {
      const carte = RATTACHER_CARTES.find((c) => c.id === kind);
      if (!carte) return;
      onPick({
        entiteType: carte.entite,
        entiteId: item.id,
        label: item.label,
        subtitle: item.subtitle,
      });
    }
    setQuery('');
  }

  return (
    <div className={`rounded-clay border border-black/[0.06] bg-surface p-3 shadow-clay-sm ${className}`}>
      <div className="flex min-h-11 items-center gap-2 rounded-full border border-black/[0.10] bg-surface px-4 max-md:min-h-12">
        <Search size={15} strokeWidth={2} className="shrink-0 text-text-muted" aria-hidden />
        <input
          id={id}
          type="search"
          value={query}
          disabled={disabled}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={PLACEHOLDER[kind]}
          aria-label={PLACEHOLDER[kind]}
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent py-2 text-[14px] text-text outline-none placeholder:text-text-subtle disabled:opacity-50"
        />
      </div>

      <div
        role="tablist"
        aria-label="Type de fiche"
        className="mt-2.5 flex rounded-clay bg-surface-2 p-1 shadow-clay-inset"
      >
        {RATTACHER_CARTES.map((carte) => {
          const actif = carte.id === kind;
          return (
            <button
              key={carte.id}
              type="button"
              role="tab"
              aria-selected={actif}
              disabled={disabled}
              onClick={() => {
                setKind(carte.id);
                setQuery('');
              }}
              className={`min-h-9 flex-1 rounded-[12px] px-1.5 py-1.5 text-[12px] font-semibold transition-colors duration-fluid-subtle ${
                actif
                  ? 'bg-surface text-text-strong shadow-clay-sm'
                  : 'text-text-muted hover:text-text-strong'
              }`}
            >
              {carte.label}
            </button>
          );
        })}
      </div>

      <div className="mt-2.5 overflow-hidden rounded-xl border border-black/[0.06] bg-surface">
        {charge && kind !== 'immeuble' ? (
          <div className="h-28 animate-pulse bg-black/[0.04]" aria-hidden />
        ) : (
          <ListeItems
            id={listId}
            items={query.trim() ? filtres : tous}
            vide={LIBELLE_VIDE[kind]}
            onPick={pickItem}
            disabled={disabled}
          />
        )}
      </div>
    </div>
  );
}

function ListeItems({
  id,
  items,
  vide,
  onPick,
  disabled,
}: {
  id: string;
  items: RattacherItem[];
  vide: string;
  onPick: (item: RattacherItem) => void;
  disabled: boolean;
}) {
  if (items.length === 0) {
    return <p className="px-3 py-3 text-pretty text-[13.5px] text-text-muted">{vide}</p>;
  }
  return (
    <ul id={id} role="listbox" aria-label="Fiches" className="max-h-64 overflow-y-auto p-1">
      {items.map((item) => (
        <li key={`${item.kind}-${item.id}`} role="option">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onPick(item)}
            title={item.subtitle ? `${item.label} · ${item.subtitle}` : item.label}
            className="flex w-full min-w-0 items-baseline gap-2 rounded-lg px-3 py-2 text-left transition-colors hover:bg-black/[0.04] focus-visible:bg-black/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent disabled:opacity-50"
          >
            <span className="shrink-0 text-[13.5px] font-medium text-text">{item.label}</span>
            {item.subtitle ? (
              <span className="min-w-0 flex-1 truncate text-[12.5px] text-text-muted">
                {item.subtitle}
              </span>
            ) : null}
          </button>
        </li>
      ))}
    </ul>
  );
}
