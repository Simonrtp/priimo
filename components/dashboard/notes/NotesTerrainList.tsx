'use client';

import { useEffect, useState } from 'react';
import type { NoteLien, NoteLienEntite, VoiceNoteVisibilite } from '@/types/contact';
import { NOTE_CONFIANCE_LABELS, NOTE_SOURCE_LABELS } from '@/types/contact';
import type { TerrainNote } from '@/types/contact';
import { notifyError, notifySuccess } from '@/lib/notify';
import WorkspaceButton from '@/components/dashboard/workspace/WorkspaceButton';

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));
}

function excerpt(text: string | null): string {
  const t = (text ?? '').trim().replace(/\s+/g, ' ');
  if (!t) return 'Sans transcription';
  return t.length > 220 ? `${t.slice(0, 219)}…` : t;
}

export default function NotesTerrainList({
  entiteType,
  entiteId,
  currentUserId,
}: {
  entiteType: NoteLienEntite;
  entiteId: string;
  currentUserId?: string;
}) {
  const [notes, setNotes] = useState<TerrainNote[] | null>(null);

  async function load() {
    try {
      const res = await fetch(
        `/api/dashboard/notes?entiteType=${encodeURIComponent(entiteType)}&entiteId=${encodeURIComponent(entiteId)}`,
      );
      const data = (await res.json()) as { notes?: TerrainNote[] };
      setNotes(data.notes ?? []);
    } catch {
      setNotes([]);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recharge quand la fiche change
  }, [entiteType, entiteId]);

  async function patchVisibilite(noteId: string, visibilite: VoiceNoteVisibilite) {
    try {
      const res = await fetch(`/api/dashboard/voice-notes/${noteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visibilite }),
      });
      if (!res.ok) throw new Error('patch');
      await load();
    } catch {
      notifyError("La visibilité n'a pas pu être enregistrée");
    }
  }

  async function confirmer(noteId: string, lien: NoteLien) {
    try {
      const res = await fetch(`/api/dashboard/voice-notes/${noteId}/liens/${lien.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmer: true }),
      });
      if (!res.ok) throw new Error('confirm');
      notifySuccess('Rattachement confirmé');
      await load();
    } catch {
      notifyError("Le rattachement n'a pas pu être confirmé");
    }
  }

  async function rejeter(noteId: string, lien: NoteLien) {
    try {
      const res = await fetch(`/api/dashboard/voice-notes/${noteId}/liens/${lien.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('delete');
      notifySuccess('Proposition écartée');
      await load();
    } catch {
      notifyError("Le rattachement n'a pas pu être retiré");
    }
  }

  if (notes === null) {
    return (
      <p className="text-text-subtle" style={{ fontSize: 14 }}>
        Chargement…
      </p>
    );
  }

  if (notes.length === 0) {
    return (
      <p className="text-pretty text-text-subtle" style={{ fontSize: 14 }}>
        Aucune note terrain pour l’instant.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-4">
      {notes.map((note) => {
        const lienIci = note.liens.find((l) => l.entiteType === entiteType && l.entiteId === entiteId);
        const probable = lienIci?.confiance === 'probable';
        const mine = currentUserId && note.createdBy === currentUserId;
        return (
          <li key={note.id} className="rounded-xl border border-black/[0.06] px-3.5 py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-[12px] text-text-subtle">
                {formatDate(note.createdAt)}
                {note.authorName ? ` · ${note.authorName}` : ''}
                {note.sourceInfo ? ` · ${NOTE_SOURCE_LABELS[note.sourceInfo]}` : ''}
              </p>
              {lienIci ? (
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    probable ? 'bg-black/[0.06] text-text-muted' : 'bg-accent/10 text-accent'
                  }`}
                >
                  {NOTE_CONFIANCE_LABELS[lienIci.confiance]}
                </span>
              ) : null}
            </div>
            <p className="mt-2 text-pretty text-text" style={{ fontSize: 14, lineHeight: 1.55 }}>
              {excerpt(note.transcript)}
            </p>
            {probable && lienIci ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <WorkspaceButton
                  type="button"
                  variant="secondary"
                  onClick={() => void confirmer(note.id, lienIci)}
                >
                  Confirmer
                </WorkspaceButton>
                <WorkspaceButton
                  type="button"
                  variant="secondary"
                  onClick={() => void rejeter(note.id, lienIci)}
                >
                  Écarter
                </WorkspaceButton>
              </div>
            ) : null}
            {mine ? (
              <label className="mt-3 flex min-h-[36px] cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  className="size-4 rounded border-black/20"
                  style={{ accentColor: '#E8743C' }}
                  checked={note.visibilite === 'privee'}
                  onChange={(e) =>
                    void patchVisibilite(note.id, e.target.checked ? 'privee' : 'agence')
                  }
                />
                <span className="text-[12.5px] text-text-muted">Garder pour moi</span>
              </label>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
