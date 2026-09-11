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
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

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
  }, []);

  useEffect(() => {
    const raw = params.get('notes');
    if (!raw) return;
    setNoteId(raw === '1' ? null : raw);
    setOuvert(true);
  }, [params]);

  const value = useMemo(() => ({ ouvrir, fermer }), [ouvrir, fermer]);
  const membre = params.get('membre');

  return (
    <NotesLectureContext.Provider value={value}>
      {children}
      {ouvert ? (
        <NotesLectureCard
          noteIdInitial={noteId}
          membreId={membre}
          onClose={fermer}
          onChoisir={setNoteId}
        />
      ) : null}
    </NotesLectureContext.Provider>
  );
}
