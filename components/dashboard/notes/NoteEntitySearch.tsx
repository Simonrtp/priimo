'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search } from 'lucide-react';
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
const MENU_GAP = 6;

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
}: {
  onPick: (pick: NoteLinkPick) => void;
  disabled?: boolean;
  excludeIds?: ReadonlySet<string>;
  id?: string;
}) {
  const listId = useId();
  const searchId = useId();
  const [kind, setKind] = useState<RattacherKind>('contact');
  const [catalogue, setCatalogue] = useState<Record<'contact' | 'bien' | 'lead', RattacherItem[]>>({
    contact: [],
    bien: [],
    lead: [],
  });
  const [charge, setCharge] = useState(true);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [banHits, setBanHits] = useState<BanHit[]>([]);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(
    null,
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

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

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) {
      setMenuPos(null);
      return;
    }
    function place() {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const r = trigger.getBoundingClientRect();
      const width = Math.max(r.width, 260);
      const spaceBelow = window.innerHeight - r.bottom - MENU_GAP - 8;
      setMenuPos({
        top: r.bottom + MENU_GAP,
        left: Math.max(8, Math.min(r.left, window.innerWidth - width - 8)),
        width,
        maxHeight: Math.min(320, Math.max(160, spaceBelow)),
      });
    }
    place();
    const raf = window.requestAnimationFrame(place);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, filtres.length]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => searchRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      const target = e.target;
      if (!(target instanceof Node)) return;
      if (rootRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      close();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
        triggerRef.current?.focus();
      }
    }
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [close, open]);

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
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="flex flex-col gap-3">
      <div>
        <p className="mb-1.5 font-medium text-text-muted" style={{ fontSize: 12.5 }}>
          Rattacher
        </p>
        <div
          role="tablist"
          aria-label="Type de fiche"
          className="flex rounded-clay bg-surface-2 p-1 shadow-clay-inset"
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
                className={`min-h-9 flex-1 rounded-[12px] px-2 py-1.5 text-[12px] font-semibold transition-colors duration-fluid-subtle ${
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
      </div>

      <button
        ref={triggerRef}
        type="button"
        id={id}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => !disabled && setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-black/[0.10] bg-surface px-3 py-2.5 text-left text-[14px] text-text outline-none hover:border-black/[0.14] focus-visible:border-accent/50 focus-visible:ring-2 focus-visible:ring-accent/15 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className="truncate text-text-muted">{PLACEHOLDER[kind]}</span>
        <ChevronDown
          size={16}
          strokeWidth={2}
          aria-hidden
          className={`shrink-0 text-text-muted transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && menuPos && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={panelRef}
              style={{
                top: menuPos.top,
                left: menuPos.left,
                width: menuPos.width,
                maxHeight: menuPos.maxHeight,
              }}
              className="fixed z-[230] flex flex-col overflow-hidden rounded-xl border border-black/[0.10] bg-surface shadow-clay-lg"
            >
              <div className="flex shrink-0 items-center gap-2 border-b border-black/[0.06] px-2.5 py-2">
                <Search size={15} strokeWidth={2} className="shrink-0 text-text-muted" aria-hidden />
                <input
                  ref={searchRef}
                  id={searchId}
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={PLACEHOLDER[kind]}
                  aria-label={PLACEHOLDER[kind]}
                  autoComplete="off"
                  className="min-w-0 flex-1 bg-transparent text-[14px] text-text outline-none placeholder:text-text-subtle"
                />
              </div>
              <ListeItems
                id={listId}
                items={filtres}
                vide={LIBELLE_VIDE[kind]}
                onPick={pickItem}
                disabled={disabled}
              />
            </div>,
            document.body,
          )
        : null}

      <div className="overflow-hidden rounded-xl border border-black/[0.08] bg-surface">
        {charge && kind !== 'immeuble' ? (
          <div className="h-28 animate-pulse bg-black/[0.04]" aria-hidden />
        ) : (
          <ListeItems
            id={`${listId}-tous`}
            items={query.trim() ? filtres : tous}
            vide={LIBELLE_VIDE[kind]}
            onPick={pickItem}
            disabled={disabled}
            maxHeightClass="max-h-64"
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
  maxHeightClass = 'max-h-full',
}: {
  id: string;
  items: RattacherItem[];
  vide: string;
  onPick: (item: RattacherItem) => void;
  disabled: boolean;
  maxHeightClass?: string;
}) {
  if (items.length === 0) {
    return (
      <p className="px-3 py-3 text-pretty text-[13.5px] text-text-muted">{vide}</p>
    );
  }
  return (
    <ul id={id} role="listbox" aria-label="Fiches" className={`overflow-y-auto p-1 ${maxHeightClass}`}>
      {items.map((item) => (
        <li key={`${item.kind}-${item.id}`} role="option">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onPick(item)}
            className="flex w-full flex-col items-start rounded-lg px-3 py-2 text-left transition-colors hover:bg-black/[0.04] focus-visible:bg-black/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent disabled:opacity-50"
          >
            <span className="text-[13.5px] font-medium text-text">{item.label}</span>
            {item.subtitle ? (
              <span className="text-[12px] text-text-muted">{item.subtitle}</span>
            ) : null}
          </button>
        </li>
      ))}
    </ul>
  );
}
