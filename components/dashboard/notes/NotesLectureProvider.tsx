'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { onNoteCreated } from '@/lib/notes/note-created-event';
import type { NoteLecture } from '@/lib/notes/lecture';
import NotesLectureCard from './NotesLectureCard';

type NotesLectureContextValue = {
  ouvrir: (noteId?: string | null) => void;
  fermer: () => void;
};

const NotesLectureContext = createContext<NotesLectureContextValue | null>(null);

export function useNotesLecture(): NotesLectureContextValue {
  const ctx = useContext(NotesLectureContext);
  if (!ctx) throw new Error('useNotesLecture must be used within NotesLectureProvider');
  return ctx;
}

export function useNotesLectureOptional(): NotesLectureContextValue | null {
  return useContext(NotesLectureContext);
}

export function NotesLectureProvider({ children }: { children: ReactNode }) {
  const [ouvert, setOuvert] = useState(false);
  const [noteId, setNoteId] = useState<string | null>(null);
  const [notes, setNotes] = useState<NoteLecture[] | null>(null);
  const [erreur, setErreur] = useState(false);
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const membre = params.get('membre');

  const charger = useCallback(
    async (signal?: AbortSignal) => {
      const q = new URLSearchParams({ scope: 'visibles', limit: '60' });
      if (membre) q.set('membre', membre);
      try {
        const res = await fetch(`/api/dashboard/notes/inbox?${q.toString()}`, { signal });
        const data = (await res.json()) as { notes?: NoteLecture[] };
        if (signal?.aborted) return;
        if (!res.ok) {
          setErreur(true);
          setNotes((deja) => deja ?? []);
          return;
        }
        setErreur(false);
        setNotes(data.notes ?? []);
      } catch {
        if (signal?.aborted) return;
        setErreur(true);
        setNotes((deja) => deja ?? []);
      }
    },
    [membre],
  );

  useEffect(() => {
    const ac = new AbortController();
    void charger(ac.signal);
    return () => ac.abort();
  }, [charger]);

  useEffect(() => onNoteCreated(() => { void charger(); }), [charger]);

  const fermer = useCallback(() => {
    setOuvert(false);
    setNoteId(null);
    if (params.get('notes') == null) return;
    const next = new URLSearchParams(params.toString());
    next.delete('notes');
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [params, pathname, router]);

  const ouvrir = useCallback((id?: string | null) => {
    setNoteId(id?.trim() || null);
    setOuvert(true);
    void charger();
  }, [charger]);

  useEffect(() => {
    const raw = params.get('notes');
    if (!raw) return;
    setNoteId(raw === '1' ? null : raw);
    setOuvert(true);
  }, [params]);

  const value = useMemo(() => ({ ouvrir, fermer }), [ouvrir, fermer]);

  return (
    <NotesLectureContext.Provider value={value}>
      {children}
      {ouvert ? (
        <NotesLectureCard
          notes={notes}
          erreur={erreur}
          noteIdInitial={noteId}
          onClose={fermer}
          onChoisir={setNoteId}
        />
      ) : null}
    </NotesLectureContext.Provider>
  );
}
