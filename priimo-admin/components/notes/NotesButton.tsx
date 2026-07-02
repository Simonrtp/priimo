'use client';

import { useState } from 'react';
import { StickyNote, X } from 'lucide-react';
import { NotesPanel } from '@/components/notes/NotesPanel';
import type { AdminNote, NoteEntityType } from '@/lib/notes/store';

/**
 * Bouton compact pour les lignes de tableau : ouvre les notes de l'entité
 * dans une fenêtre modale. Affiche le nombre de notes existantes.
 */
export function NotesButton({
  entityType,
  entityId,
  title,
  subtitle,
  initialNotes,
}: {
  entityType: NoteEntityType;
  entityId: string;
  title: string;
  subtitle?: string;
  initialNotes: AdminNote[];
}) {
  const [open, setOpen] = useState(false);
  const count = initialNotes.length;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
          count > 0
            ? 'border-amber-500/30 bg-amber-500/10 text-amber-300 hover:border-amber-500/50 hover:bg-amber-500/15'
            : 'border-white/10 bg-white/[0.03] text-white/55 hover:border-indigo-500/40 hover:text-indigo-300'
        }`}
        title={count > 0 ? `${count} note(s) — cliquer pour consulter` : 'Ajouter une note'}
      >
        <StickyNote className="h-3.5 w-3.5" />
        {count > 0 ? `Notes (${count})` : 'Note'}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="max-h-[85vh] w-full max-w-lg animate-fade-in overflow-auto rounded-2xl border border-white/[0.08] bg-[#0e0e16] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 flex items-center justify-between gap-3 border-b border-white/[0.06] bg-[#0e0e16]/95 px-5 py-4 backdrop-blur">
              <div className="min-w-0">
                <h2 className="flex items-center gap-2 truncate text-sm font-semibold text-white">
                  <StickyNote className="h-4 w-4 shrink-0 text-amber-400" />
                  Notes — {title}
                </h2>
                {subtitle ? <p className="mt-0.5 truncate text-xs text-white/40">{subtitle}</p> : null}
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="shrink-0 rounded-lg p-1.5 text-white/50 hover:bg-white/[0.06] hover:text-white"
                aria-label="Fermer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5">
              <NotesPanel
                entityType={entityType}
                entityId={entityId}
                initialNotes={initialNotes}
                autoFocus
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
