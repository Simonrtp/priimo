'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, MapPin } from 'lucide-react';
import { banFeatureToSelectedAddress, searchBanAddresses, type BanFeature, type SelectedAddress } from '@/lib/ban';

export type { SelectedAddress };

interface AddressAutocompleteProps {
  value?: string;
  onChange: (data: SelectedAddress | null) => void;
  /** Saisie libre (même sans suggestion choisie). */
  onQueryChange?: (query: string) => void;
  /** Filtre BAN sur un code postal (ex. secteur agence). */
  postcodeFilter?: string;
  placeholder?: string;
  required?: boolean;
  id?: string;
  inputClassName?: string;
  'aria-label'?: string;
}

const defaultInputClass =
  'w-full rounded-xl border border-black/10 bg-white py-3 pl-10 pr-10 text-base text-ink placeholder-gray-500/70 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15';

function measureMenuBox(el: HTMLElement | null) {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width <= 0) return null;
  return { top: r.bottom + 6, left: r.left, width: r.width };
}

export default function AddressAutocomplete({
  value = '',
  onChange,
  onQueryChange,
  postcodeFilter,
  placeholder = 'Ex : 12 rue de la Paix, Paris',
  required = false,
  id,
  inputClassName = defaultInputClass,
  'aria-label': ariaLabel,
}: AddressAutocompleteProps) {
  const listId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** true seulement après saisie utilisateur — évite de rouvrir la BAN sur une adresse déjà enregistrée. */
  const userEditedRef = useRef(false);
  const requestIdRef = useRef(0);

  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<BanFeature[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [menuBox, setMenuBox] = useState<{ top: number; left: number; width: number } | null>(null);

  useEffect(() => {
    if (userEditedRef.current) return;
    setQuery(value);
    setSuggestions([]);
    setShowDropdown(false);
    setActiveIndex(-1);
  }, [value]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!userEditedRef.current) {
      setSuggestions([]);
      setIsLoading(false);
      setShowDropdown(false);
      setActiveIndex(-1);
      return;
    }

    if (query.trim().length < 3) {
      setSuggestions([]);
      setIsLoading(false);
      setShowDropdown(false);
      setActiveIndex(-1);
      return;
    }

    const ac = new AbortController();
    const requestId = ++requestIdRef.current;
    const safetyTimer = setTimeout(() => ac.abort(), 25_000);

    debounceRef.current = setTimeout(async () => {
      setIsLoading(true);
      try {
        let features = await searchBanAddresses(query.trim(), 5, postcodeFilter, ac.signal);
        if (features.length === 0 && postcodeFilter && !ac.signal.aborted) {
          features = await searchBanAddresses(query.trim(), 5, undefined, ac.signal);
        }
        if (ac.signal.aborted || requestId !== requestIdRef.current) return;
        const box = measureMenuBox(containerRef.current);
        if (box) setMenuBox(box);
        setSuggestions(features);
        setShowDropdown(features.length > 0);
        setActiveIndex(-1);
      } catch {
        if (requestId !== requestIdRef.current) return;
        // Nouvelle saisie : ne pas vider les suggestions encore valides.
        if (ac.signal.aborted) return;
        setSuggestions([]);
        setShowDropdown(false);
      } finally {
        if (requestId === requestIdRef.current) setIsLoading(false);
      }
    }, 250);

    return () => {
      clearTimeout(safetyTimer);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      ac.abort();
    };
  }, [query, postcodeFilter]);

  useLayoutEffect(() => {
    if (!showDropdown) return;
    function place() {
      const box = measureMenuBox(containerRef.current);
      if (box) setMenuBox(box);
    }
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [showDropdown, suggestions.length]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (containerRef.current?.contains(target)) return;
      const list = document.getElementById(listId);
      if (list?.contains(target)) return;
      setShowDropdown(false);
      setActiveIndex(-1);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [listId]);

  const selectFeature = (feature: BanFeature) => {
    const selected = banFeatureToSelectedAddress(feature);
    userEditedRef.current = false;
    setQuery(selected.label);
    setShowDropdown(false);
    setSuggestions([]);
    setActiveIndex(-1);
    onChange(selected);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    userEditedRef.current = true;
    setQuery(next);
    onQueryChange?.(next);
    onChange(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      selectFeature(suggestions[activeIndex]);
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
      setActiveIndex(-1);
    }
  };

  const list =
    showDropdown && suggestions.length > 0 && menuBox && typeof document !== 'undefined'
      ? createPortal(
          <ul
            id={listId}
            role="listbox"
            style={{ top: menuBox.top, left: menuBox.left, width: menuBox.width }}
            className="fixed z-[400] max-h-60 overflow-auto rounded-xl border border-black/8 bg-white p-1 shadow-soft"
          >
            {suggestions.map((feature, index) => {
              const isActive = index === activeIndex;
              return (
                <li key={`${feature.properties.label}-${index}`} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => selectFeature(feature)}
                    className={`flex w-full items-start gap-2 rounded-lg px-3 py-2.5 text-left transition-colors ${
                      isActive ? 'bg-soft-warm text-ink' : 'text-ink hover:bg-black/[0.04]'
                    }`}
                  >
                    <MapPin className="mt-0.5 size-4 flex-shrink-0 text-mute" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{feature.properties.label}</span>
                      <span className="block truncate text-xs text-mute">{feature.properties.context}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>,
          document.body,
        )
      : null;

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <MapPin
          className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-mute"
          aria-hidden
        />
        <input
          id={id}
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => {
            if (userEditedRef.current && suggestions.length > 0) {
              const box = measureMenuBox(containerRef.current);
              if (box) setMenuBox(box);
              setShowDropdown(true);
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          required={required}
          autoComplete="off"
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-label={ariaLabel}
          className={inputClassName}
        />
        {isLoading && (
          <Loader2
            className="absolute right-3 top-1/2 size-5 -translate-y-1/2 animate-spin text-mute"
            aria-hidden
          />
        )}
      </div>
      {list}
    </div>
  );
}
