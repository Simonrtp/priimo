'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import {
  flushQueue,
  listQueue,
  OFFLINE_QUEUE_CHANGED_EVENT,
} from '@/lib/offline/queue';
import { notifySuccess } from '@/lib/notify';

type OfflineQueueContextValue = {
  pending: number;
  flush: () => Promise<void>;
  refresh: () => Promise<void>;
};

const OfflineQueueContext = createContext<OfflineQueueContextValue | null>(null);

export function useOfflineQueue(): OfflineQueueContextValue {
  const ctx = useContext(OfflineQueueContext);
  if (!ctx) {
    return {
      pending: 0,
      flush: async () => undefined,
      refresh: async () => undefined,
    };
  }
  return ctx;
}

export default function OfflineQueueProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [pending, setPending] = useState(0);
  const flushEnCours = useRef<Promise<void> | null>(null);

  const refresh = useCallback(async () => {
    const items = await listQueue();
    setPending(items.length);
  }, []);

  const flush = useCallback(async () => {
    if (flushEnCours.current) return flushEnCours.current;
    const travail = (async () => {
      const resultat = await flushQueue();
      await refresh();
      if (resultat.sent > 0) {
        notifySuccess(
          `${resultat.sent} envoi${resultat.sent > 1 ? 's' : ''} hors ligne synchronisé${resultat.sent > 1 ? 's' : ''}`,
        );
        router.refresh();
      }
    })().finally(() => {
      flushEnCours.current = null;
    });
    flushEnCours.current = travail;
    return travail;
  }, [refresh, router]);

  useEffect(() => {
    // Reprise immédiate après réouverture de l'app : ne pas attendre le
    // prochain focus ni l'intervalle de 30 secondes.
    void flush();
    function onOnline() {
      void flush();
    }
    function onFocus() {
      void flush();
    }
    function onQueueChanged() {
      void refresh();
    }
    window.addEventListener('online', onOnline);
    window.addEventListener('focus', onFocus);
    window.addEventListener(OFFLINE_QUEUE_CHANGED_EVENT, onQueueChanged);
    const timer = window.setInterval(() => {
      if (navigator.onLine) void flush();
    }, 30_000);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener(OFFLINE_QUEUE_CHANGED_EVENT, onQueueChanged);
      window.clearInterval(timer);
    };
  }, [flush, refresh]);

  const value = useMemo(
    () => ({ pending, flush, refresh }),
    [pending, flush, refresh],
  );

  return (
    <OfflineQueueContext.Provider value={value}>{children}</OfflineQueueContext.Provider>
  );
}
