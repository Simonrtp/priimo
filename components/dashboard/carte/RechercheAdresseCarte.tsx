'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { CircleX, MapPin, Search } from 'lucide-react';
import { searchBanAddresses } from '@/lib/ban';
import { versAdressesTrouvees, type AdresseTrouvee } from '@/lib/ban-recherche';
import { viserSurLaCarte } from '@/lib/carte/cible';
import { useUser } from '@/lib/hooks/useUser';

const ADRESSES_MAX = 6;
const DEBOUNCE_MS = 160;

/**
 * Aller à une adresse, collée aux onglets de la carte. Toujours ouverte :
 * on tape, on choisit, la carte vole. La liste se referme seule après choix
 * ou Escape — le champ reste visible.
 */
export default function RechercheAdresseCarte() {
  const { agency } = useUser();
  const champId = useId();
  const listeId = useId();
  const champ = useRef<HTMLInputElement | null>(null);
  const racine = useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = useState('');
  const [adresses, setAdresses] = useState<AdresseTrouvee[]>([]);
  const [recherche, setRecherche] = useState(false);
  const [actif, setActif] = useState(0);
  const [listeOuverte, setListeOuverte] = useState(false);

  const proche = useMemo(
    () =>
      agency.latitude != null && agency.longitude != null
        ? { latitude: agency.latitude, longitude: agency.longitude }
        : null,
    [agency.latitude, agency.longitude],
  );

  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) {
      setAdresses([]);
      setListeOuverte(false);
      return;
    }
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => {
      setRecherche(true);
      void searchBanAddresses(q, ADRESSES_MAX, undefined, ctrl.signal, proche)
        .then((features) => {
          if (ctrl.signal.aborted) return;
          setAdresses(versAdressesTrouvees(features));
          setActif(0);
          setListeOuverte(true);
        })
        .catch(() => undefined)
        .finally(() => {
          if (!ctrl.signal.aborted) setRecherche(false);
        });
    }, DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      ctrl.abort();
    };
  }, [query, proche]);

  useEffect(() => {
    if (!listeOuverte) return;
    const ailleurs = (e: MouseEvent) => {
      if (racine.current?.contains(e.target as Node)) return;
      setListeOuverte(false);
    };
    document.addEventListener('mousedown', ailleurs);
    return () => document.removeEventListener('mousedown', ailleurs);
  }, [listeOuverte]);

  const q = query.trim();
  const liste = q.length >= 3 ? adresses : [];
  const montrerListe = listeOuverte && q.length >= 3;

  function effacer() {
    setQuery('');
    setAdresses([]);
    setListeOuverte(false);
    champ.current?.focus();
  }

  function choisir(a: AdresseTrouvee) {
    viserSurLaCarte({ latitude: a.latitude, longitude: a.longitude, libelle: a.label, banId: a.banId });
    setQuery('');
    setAdresses([]);
    setListeOuverte(false);
    champ.current?.blur();
  }

  return (
    <div ref={racine} className="relative mr-1 flex items-center">
      <div className="flex h-[34px] w-[17rem] items-center overflow-hidden rounded-full bg-bg-subtle">
        <button
          type="button"
          onClick={() => champ.current?.focus()}
          aria-label="Aller à une adresse"
          title="Aller à une adresse"
          className="flex size-[34px] shrink-0 items-center justify-center rounded-full text-text-muted transition-colors hover:text-text-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary-500"
        >
          <Search size={16} strokeWidth={2.2} aria-hidden />
        </button>
        <label htmlFor={champId} className="sr-only">
          Aller à une adresse
        </label>
        <input
          ref={champ}
          id={champId}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (query.trim().length >= 3) setListeOuverte(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              if (montrerListe) setListeOuverte(false);
              else if (query) effacer();
              else champ.current?.blur();
            } else if (e.key === 'ArrowDown' && liste.length) {
              e.preventDefault();
              setListeOuverte(true);
              setActif((i) => (i + 1) % liste.length);
            } else if (e.key === 'ArrowUp' && liste.length) {
              e.preventDefault();
              setActif((i) => (i - 1 + liste.length) % liste.length);
            } else if (e.key === 'Enter' && liste[actif]) {
              e.preventDefault();
              choisir(liste[actif]!);
            }
          }}
          placeholder="Aller à une adresse…"
          autoComplete="off"
          enterKeyHint="go"
          role="combobox"
          aria-expanded={montrerListe}
          aria-controls={listeId}
          aria-activedescendant={montrerListe && liste.length ? `${listeId}-${actif}` : undefined}
          className="assistant-search-input min-w-0 flex-1 bg-transparent pr-1 text-[13.5px] text-text-strong outline-none placeholder:text-text-subtle"
        />
        {query ? (
          <button
            type="button"
            onClick={effacer}
            aria-label="Effacer l’adresse"
            className="mr-1 flex size-7 shrink-0 items-center justify-center rounded-full text-text-subtle transition-colors hover:bg-black/[0.06] hover:text-text"
          >
            <CircleX size={15} strokeWidth={1.8} aria-hidden />
          </button>
        ) : null}
      </div>

      {montrerListe ? (
        <div
          id={listeId}
          role="listbox"
          aria-label="Adresses"
          className="absolute right-0 top-[calc(100%+10px)] z-40 w-[22rem] overflow-hidden rounded-clay-lg border border-black/[0.06] bg-surface p-1.5 shadow-clay-lg"
        >
          {liste.length === 0 ? (
            <p className="px-3 py-2.5 text-[13px] text-text-muted" role="status">
              {recherche ? 'Recherche…' : `Aucune adresse pour « ${q} ».`}
            </p>
          ) : (
            <ul className="flex flex-col">
              {liste.map((a, i) => (
                <li key={a.id} id={`${listeId}-${i}`} role="option" aria-selected={actif === i}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseMove={() => setActif(i)}
                    onClick={() => choisir(a)}
                    className={`flex w-full min-w-0 items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors duration-fluid-subtle ${
                      actif === i ? 'bg-primary-50' : ''
                    }`}
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-bg-subtle text-text-muted">
                      <MapPin size={15} strokeWidth={2} aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-medium text-text-strong">{a.label}</span>
                      {a.contexte ? (
                        <span className="mt-px block truncate text-[12px] text-text-muted">{a.contexte}</span>
                      ) : null}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
