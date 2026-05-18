'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Loader2, MapPin } from 'lucide-react';
import { banFeatureToSelectedAddress, searchBanAddresses, type BanFeature, type SelectedAddress } from '@/lib/ban';

export type { SelectedAddress };

interface AddressAutocompleteProps {
  value?: string;
  onChange: (data: SelectedAddress | null) => void;
  placeholder?: string;
  required?: boolean;
  id?: string;
  inputClassName?: string;
}

const defaultInputClass =
  'w-full rounded-xl border border-black/10 bg-white py-3 pl-10 pr-10 text-base text-ink placeholder-gray-500/70 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15';

export default function AddressAutocomplete({
  value = '',
  onChange,
  placeholder = 'Ex : 12 rue de la Paix, Paris',
  required = false,
  id,
  inputClassName = defaultInputClass,
}: AddressAutocompleteProps) {
  const listId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<BanFeature[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.trim().length < 3) {
      setSuggestions([]);
      setIsLoading(false);
      setActiveIndex(-1);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setIsLoading(true);
      try {
        const features = await searchBanAddresses(query.trim(), 5);
        setSuggestions(features);
        setShowDropdown(features.length > 0);
        setActiveIndex(-1);
      } catch {
        setSuggestions([]);
        setShowDropdown(false);
      } finally {
        setIsLoading(false);
      }
    }, 250);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectFeature = (feature: BanFeature) => {
    const selected = banFeatureToSelectedAddress(feature);
    setQuery(selected.label);
    setShowDropdown(false);
    setSuggestions([]);
    setActiveIndex(-1);
    onChange(selected);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    setQuery(next);
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
          onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          required={required}
          autoComplete="off"
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls={listId}
          aria-autocomplete="list"
          className={inputClassName}
        />
        {isLoading && (
          <Loader2
            className="absolute right-3 top-1/2 size-5 -translate-y-1/2 animate-spin text-mute"
            aria-hidden
          />
        )}
      </div>

      {showDropdown && suggestions.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1.5 max-h-60 w-full overflow-auto rounded-xl border border-black/8 bg-white p-1 shadow-soft"
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
        </ul>
      )}
    </div>
  );
}
