'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

/**
 * État chrome de la barre de recherche (pas la query : elle reste locale
 * au champ pour éviter de re-rendre le shell à chaque frappe).
 */
interface RechercheContextValue {
  panelOpen: boolean;
  setPanelOpen: (open: boolean) => void;
  focusSearch: () => void;
  registerInput: (el: HTMLInputElement | null) => void;
  mobileSearchOpen: boolean;
  openMobileSearch: () => void;
  closeMobileSearch: () => void;
  closeResults: () => void;
}

const RechercheContext = createContext<RechercheContextValue | null>(null);

export function useAssistant(): RechercheContextValue {
  const ctx = useContext(RechercheContext);
  if (!ctx) throw new Error('useAssistant must be used within AssistantProvider');
  return ctx;
}

export default function AssistantProvider({ children }: { children: React.ReactNode }) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const registerInput = useCallback((el: HTMLInputElement | null) => {
    inputRef.current = el;
  }, []);

  const [panelOpen, setPanelOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  const focusSearch = useCallback(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches) {
      setMobileSearchOpen(true);
    }
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  const openMobileSearch = useCallback(() => {
    setMobileSearchOpen(true);
    setPanelOpen(true);
  }, []);

  const closeMobileSearch = useCallback(() => {
    setMobileSearchOpen(false);
    setPanelOpen(false);
  }, []);

  const closeResults = useCallback(() => {
    setPanelOpen(false);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        focusSearch();
      }
      if (e.key === 'Escape') {
        setPanelOpen(false);
        setMobileSearchOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [focusSearch]);

  const value = useMemo(
    () => ({
      panelOpen,
      setPanelOpen,
      focusSearch,
      registerInput,
      mobileSearchOpen,
      openMobileSearch,
      closeMobileSearch,
      closeResults,
    }),
    [
      panelOpen,
      focusSearch,
      registerInput,
      mobileSearchOpen,
      openMobileSearch,
      closeMobileSearch,
      closeResults,
    ],
  );

  return <RechercheContext.Provider value={value}>{children}</RechercheContext.Provider>;
}
