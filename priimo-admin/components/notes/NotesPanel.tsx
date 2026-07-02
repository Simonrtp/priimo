'use client';

import { useState, useTransition } from 'react';
import { Loader2, Plus, StickyNote, Trash2 } from 'lucide-react';
import { addNote, deleteNote } from '@/lib/actions/notes';
import type { AdminNote, NoteEntityType } from '@/lib/notes/store';
import { formatDate } from '@/lib/utils/format';

/**
 * Bloc de prise de notes réutilisable (agence ou utilisateur) :
 * zone de saisie + historique horodaté, du plus récent au plus ancien.
 */
export function NotesPanel({
  entityType,
  entityId,
  initialNotes,
  autoFocus = false,
}: {
  entityType: NoteEntityType;
  entityId: string;
  initialNotes: AdminNote[];
  autoFocus?: boolean;
}) {
  const [notes, setNotes] = useState<AdminNote[]>(initialNotes);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleAdd() {
    const value = text.trim();
    if (!value || pending) return;
    setError(null);
    startTransition(async () => {
      const result = await addNote(entityType, entityId, value);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setNotes((prev) => [result.note, ...prev]);
      setText('');
    });
  }

  function handleDelete(id: string) {
    if (!confirm('Supprimer cette note ?')) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteNote(id);
      if (!result.ok) {
        setError(result.error ?? 'Erreur lors de la suppression.');
        return;
      }
      setNotes((prev) => prev.filter((n) => n.id !== id));
    });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              handleAdd();
            }
          }}
          autoFocus={autoFocus}
          rows={3}
          placeholder="Compte-rendu d'appel, infos données en rendez-vous, points à suivre…"
          className="input-dark w-full resize-y text-sm leading-relaxed"
        />
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] text-white/30">Ctrl+Entrée pour enregistrer</p>
          <button
            type="button"
            onClick={handleAdd}
            disabled={pending || !text.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-500 px-3 py-2 text-xs font-medium text-white transition hover:bg-indigo-400 disabled:opacity-40"
          >
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Ajouter la note
          </button>
        </div>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {error}
        </p>
      ) : null}

      {notes.length === 0 ? (
        <p className="flex items-center gap-2 rounded-lg border border-dashed border-white/10 px-3 py-3 text-xs text-white/35">
          <StickyNote className="h-3.5 w-3.5 shrink-0" />
          Aucune note pour le moment.
        </p>
      ) : (
        <ul className="space-y-2.5">
          {notes.map((note) => (
            <li
              key={note.id}
              className="group rounded-xl border border-white/[0.07] bg-white/[0.03] p-3.5"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/85">{note.text}</p>
                <button
                  type="button"
                  onClick={() => handleDelete(note.id)}
                  disabled={pending}
                  className="shrink-0 rounded-lg p-1.5 text-white/25 opacity-0 transition hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100 disabled:opacity-30"
                  title="Supprimer la note"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="mt-2 text-[11px] text-white/35">{formatDate(note.createdAt)}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
