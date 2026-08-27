'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

type TourneeDictationContextValue = {
  adresse: string | null;
  leadId: string | null;
  setStop: (stop: { adresse: string; leadId: string } | null) => void;
  /** Incrémente à chaque dictée réussie (ou mise en file) pendant la tournée. */
  noteDictee: () => void;
  dicteeCount: number;
};

const TourneeDictationContext = createContext<TourneeDictationContextValue | null>(null);

export function useTourneeDictation(): TourneeDictationContextValue {
  const ctx = useContext(TourneeDictationContext);
  if (!ctx) {
    return {
      adresse: null,
      leadId: null,
      setStop: () => undefined,
      noteDictee: () => undefined,
      dicteeCount: 0,
    };
  }
  return ctx;
}

export default function TourneeDictationProvider({ children }: { children: ReactNode }) {
  const [adresse, setAdresse] = useState<string | null>(null);
  const [leadId, setLeadId] = useState<string | null>(null);
  const [dicteeCount, setDicteeCount] = useState(0);

  const setStop = useCallback((stop: { adresse: string; leadId: string } | null) => {
    setAdresse(stop?.adresse ?? null);
    setLeadId(stop?.leadId ?? null);
  }, []);

  const noteDictee = useCallback(() => {
    setDicteeCount((n) => n + 1);
  }, []);

  const value = useMemo(
    () => ({ adresse, leadId, setStop, noteDictee, dicteeCount }),
    [adresse, leadId, setStop, noteDictee, dicteeCount],
  );

  return (
    <TourneeDictationContext.Provider value={value}>{children}</TourneeDictationContext.Provider>
  );
}
