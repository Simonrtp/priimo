'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CircleX, Search } from 'lucide-react';
import type { SearchHit } from '@/lib/assistant/search';
import { searchBanAddresses } from '@/lib/ban';
import { carteOuverte, hrefCarte, viserSurLaCarte } from '@/lib/carte/cible';
import { useUser } from '@/lib/hooks/useUser';
import { ressembleAdresse, ressembleQuestion } from '@/lib/assistant/intention-recherche';
import { versAdressesTrouvees, type AdresseTrouvee } from '@/lib/ban-recherche';
import ResultatsRecherche, { type ChoixRecherche } from './ResultatsRecherche';
import { useAssistant } from './AssistantProvider';
import { useAssistantPanel } from './AssistantPanelProvider';
import MicroGoutte from '@/components/dashboard/voice/MicroGoutte';

/**
 * La barre unique du tableau de bord. On y tape ce qu'on cherche — un nom,
 * une adresse, une question — et elle répond de la bonne façon : une fiche
 * s'ouvre, la carte se pose sur l'adresse, ou « Mon assistant » prend la
 * question. Aucun modèle pendant la frappe : les fiches et les adresses
 * arrivent instantanément, l'assistant n'est appelé que si on le choisit.
 */
export const PLACEHOLDER_RECHERCHE = 'Un nom, une adresse, une question…';
const FICHES_MAX = 6;
const ADRESSES_MAX = 4;
const DEBOUNCE_MS = 180;

function SearchField({
  className = '',
  autoFocus = false,
  tone = 'light',
  avecMicro = false,
}: {
  className?: string;
  autoFocus?: boolean;
  tone?: 'light' | 'shell' | 'map';
  /** Le micro unique (note ou question), accroché au bout de la barre. */
  avecMicro?: boolean;
}) {
  const inputId = useId();
  const listeId = useId();
  const router = useRouter();
  const { agency } = useUser();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [adresses, setAdresses] = useState<AdresseTrouvee[]>([]);
  const [searching, setSearching] = useState(false);
  const [actif, setActif] = useState(0);
  const { panelOpen, setPanelOpen, registerInput, closeResults, closeMobileSearch } = useAssistant();
  const { openPanel, envoyer } = useAssistantPanel();

  const proche = useMemo(
    () =>
      agency.latitude != null && agency.longitude != null
        ? { latitude: agency.latitude, longitude: agency.longitude }
        : null,
    [agency.latitude, agency.longitude],
  );

  function setInputRef(el: HTMLInputElement | null) {
    inputRef.current = el;
    registerInput(el);
  }

  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) closeResults();
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [closeResults]);

  // Une frappe, deux requêtes en parallèle : les fiches de l'agence et les
  // adresses de France (proches de l'agence d'abord). Aucun modèle.
  useEffect(() => {
    const q = query.trim();
    // Moins de deux lettres : rien à chercher, les résultats affichés sont vides (voir plus bas).
    if (q.length < 2) return;

    const ctrl = new AbortController();
    const timer = window.setTimeout(() => {
      setSearching(true);
      const fiches = fetch(`/api/assistant/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        .then((res) => (res.ok ? (res.json() as Promise<{ hits?: SearchHit[] }>) : { hits: [] }))
        .then((body) => (body.hits ?? []).slice(0, FICHES_MAX))
        .catch(() => [] as SearchHit[]);
      const lieux =
        q.length >= 3
          ? searchBanAddresses(q, ADRESSES_MAX, undefined, ctrl.signal, proche)
              // « 148 Rue de Belleville » en titre, « 75020 Paris » dessous : rien de répété.
              .then(versAdressesTrouvees)
              .catch(() => [] as AdresseTrouvee[])
          : Promise.resolve([] as AdresseTrouvee[]);

      void Promise.all([fiches, lieux]).then(([f, l]) => {
        if (ctrl.signal.aborted) return;
        setHits(f);
        // Un nom de personne trouvé : les rues homonymes ne viennent qu'en appoint.
        setAdresses(ressembleAdresse(q) || f.length === 0 ? l : l.slice(0, 1));
        setSearching(false);
        setActif(ressembleQuestion(q) ? f.length + l.length : 0);
      });
    }, DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      ctrl.abort();
    };
  }, [query, proche]);

  const trimmed = query.trim();
  const showPanel = panelOpen && trimmed.length >= 2;
  // Les résultats d'une frappe précédente ne survivent pas à un champ vidé.
  const fiches = trimmed.length >= 2 ? hits : [];
  const lieux = trimmed.length >= 2 ? adresses : [];
  const nbChoix = fiches.length + lieux.length + 1;
  const surCarte = showPanel && carteOuverte();

  function terminer() {
    setQuery('');
    setHits([]);
    setAdresses([]);
    closeResults();
    closeMobileSearch();
    inputRef.current?.blur();
  }

  function choisir(choix: ChoixRecherche) {
    if (choix.type === 'assistant') {
      const question = trimmed;
      terminer();
      // La question est posée : l'agent voit la réponse arriver, sans second geste.
      openPanel();
      void envoyer(question);
      return;
    }
    if (choix.type === 'adresse') {
      const a = choix.adresse;
      const cible = { latitude: a.latitude, longitude: a.longitude, libelle: a.label, banId: a.banId };
      terminer();
      if (carteOuverte()) viserSurLaCarte(cible);
      else router.push(hrefCarte(cible));
      return;
    }
    const { hit } = choix;
    terminer();
    // Sur la carte, une fiche située y amène : on reste sur le plan.
    if (carteOuverte() && hit.lieu) {
      viserSurLaCarte({
        latitude: hit.lieu.latitude,
        longitude: hit.lieu.longitude,
        libelle: hit.label,
        banId: hit.lieu.banId,
      });
      return;
    }
    router.push(hit.href);
  }

  function choisirIndex(i: number) {
    if (i < fiches.length) choisir({ type: 'fiche', hit: fiches[i]! });
    else if (i < fiches.length + lieux.length) choisir({ type: 'adresse', adresse: lieux[i - fiches.length]! });
    else choisir({ type: 'assistant' });
  }

  const shell = tone === 'shell';
  const map = tone === 'map';

  return (
    <div ref={rootRef} className={`${map ? '' : 'relative'} min-w-0 ${className}`} data-barre-recherche="">
      <div className="flex min-w-0 items-center">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (trimmed.length >= 2) choisirIndex(Math.min(actif, nbChoix - 1));
        }}
        className={`flex min-w-0 flex-1 items-center gap-1.5 transition-colors duration-fluid-subtle ease-in-out ${
          avecMicro
            ? // Bout droit carré : la goutte du micro prend le relais, sans liseré.
              // h-9 = même hauteur que la barre shell, pour un espace égal au-dessus et en dessous.
              'h-9 rounded-l-full bg-white pl-3.5 pr-1'
            : shell
            ? 'h-9 rounded-full bg-white pl-3.5 pr-1 shadow-sm focus-within:ring-2 focus-within:ring-white/35'
            : map
              ? 'min-h-[40px] px-1'
              : 'h-9 rounded-full px-3.5 py-1.5 assistant-search-field'
        }`}
      >
        <Search size={15} strokeWidth={2} className="shrink-0 text-mute" aria-hidden />
        <label htmlFor={inputId} className="sr-only">
          Chercher un nom, une adresse, ou poser une question
        </label>
        <input
          ref={setInputRef}
          id={inputId}
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (e.target.value.trim().length >= 2) setPanelOpen(true);
          }}
          onFocus={() => setPanelOpen(true)}
          onKeyDown={(e) => {
            if (!showPanel) return;
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActif((i) => (i + 1) % nbChoix);
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActif((i) => (i - 1 + nbChoix) % nbChoix);
            }
          }}
          placeholder={PLACEHOLDER_RECHERCHE}
          autoComplete="off"
          autoFocus={autoFocus}
          enterKeyHint="search"
          role="combobox"
          aria-expanded={showPanel}
          aria-controls={listeId}
          aria-activedescendant={showPanel ? `${listeId}-${actif}` : undefined}
          className="assistant-search-input min-w-0 flex-1 truncate bg-transparent text-[13px] text-ink outline-none placeholder:text-mute"
        />
        {query ? (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setHits([]);
              setAdresses([]);
              setPanelOpen(false);
              inputRef.current?.focus();
            }}
            aria-label="Effacer la recherche"
            title="Effacer"
            className="flex size-6 shrink-0 items-center justify-center rounded-full text-mute transition-colors duration-fluid-subtle ease-in-out hover:bg-black/[0.06] hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
          >
            <CircleX size={15} strokeWidth={1.75} aria-hidden />
          </button>
        ) : null}
      </form>
      {avecMicro ? <MicroGoutte /> : null}
      </div>

      {showPanel ? (
        <div
          id={listeId}
          className="absolute left-0 right-0 top-[calc(100%+8px)] z-[120] max-h-[min(60vh,440px)] overflow-y-auto overflow-x-hidden rounded-clay-lg border border-black/[0.06] bg-surface shadow-clay-lg"
          aria-live="polite"
        >
          <ResultatsRecherche
            query={trimmed}
            fiches={fiches}
            adresses={lieux}
            recherche={searching}
            actif={actif}
            onActif={setActif}
            onChoisir={choisir}
            idPrefix={listeId}
            surCarte={surCarte}
          />
        </div>
      ) : null}
    </div>
  );
}

export function AssistantSearchBar({ tone = 'light' }: { tone?: 'light' | 'shell' }) {
  return <SearchField className="w-full" tone={tone} avecMicro={tone === 'shell'} />;
}

export function AssistantMobileSearchBar({ tone = 'light' }: { tone?: 'light' | 'shell' | 'map' }) {
  const { mobileSearchOpen } = useAssistant();
  if (!mobileSearchOpen) return null;
  return <SearchField className="w-full" autoFocus tone={tone} />;
}

export function AssistantSearchIconButton({ className = '' }: { className?: string }) {
  const { openMobileSearch } = useAssistant();
  return (
    <button
      type="button"
      onClick={openMobileSearch}
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-mute transition-colors duration-fluid-subtle ease-in-out hover:bg-black/[0.04] hover:text-ink md:h-9 md:w-9 ${className}`}
      aria-label="Chercher ou demander"
      title="Chercher ou demander"
    >
      <Search size={20} strokeWidth={2} aria-hidden />
    </button>
  );
}
