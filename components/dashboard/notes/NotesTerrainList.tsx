'use client';

import { useEffect, useRef, useState } from 'react';
import { Mail, MapPin, Pencil, Phone, UserRound } from 'lucide-react';
import type { NoteLien, NoteLienEntite, VoiceNoteVisibilite } from '@/types/contact';
import { NOTE_CONFIANCE_LABELS, NOTE_SOURCE_LABELS } from '@/types/contact';
import type { TerrainNote } from '@/types/contact';
import { notifyError, notifySuccess } from '@/lib/notify';
import WorkspaceButton from '@/components/dashboard/workspace/WorkspaceButton';
import ChoixVisibilite from '@/components/dashboard/workspace/ChoixVisibilite';
import { LIBELLE_ENTITE } from '@/lib/notes/rattachement';
import { onNoteCreated } from '@/lib/notes/note-created-event';
import CollaborateurNom from '@/components/dashboard/CollaborateurNom';
import NoteFiche from '@/components/dashboard/notes/NoteFiche';
import { resumeCarteNote } from '@/lib/notes/note-card';
import { useUser } from '@/lib/hooks/useUser';

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));
}

export default function NotesTerrainList({
  entiteType,
  entiteId,
  currentUserId,
  focusNoteId,
  peutSupprimer = false,
}: {
  entiteType: NoteLienEntite;
  entiteId: string;
  currentUserId?: string;
  focusNoteId?: string | null;
  /** Sur la fiche parcelle : l'auteur retire sa note sans ouvrir la fiche. */
  peutSupprimer?: boolean;
}) {
  const { profile } = useUser();
  const viewerId = currentUserId ?? profile?.id;
  const [notes, setNotes] = useState<TerrainNote[] | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteASupprimer, setNoteASupprimer] = useState<string | null>(null);
  const [suppression, setSuppression] = useState(false);
  const focusNoteRef = useRef<HTMLLIElement | null>(null);
  const lectureRef = useRef(0);

  async function load() {
    const lecture = ++lectureRef.current;
    try {
      const res = await fetch(
        `/api/dashboard/notes?entiteType=${encodeURIComponent(entiteType)}&entiteId=${encodeURIComponent(entiteId)}`,
        { cache: 'no-store' },
      );
      if (lecture !== lectureRef.current) return;
      const data = (await res.json()) as { notes?: TerrainNote[] };
      setNotes(data.notes ?? []);
    } catch {
      if (lecture !== lectureRef.current) return;
      setNotes([]);
    }
  }

  useEffect(() => {
    void load();
    return onNoteCreated(() => {
      void load();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recharge quand la fiche change
  }, [entiteType, entiteId]);

  useEffect(() => {
    if (!focusNoteId || !notes?.some((note) => note.id === focusNoteId)) return;
    const frame = window.requestAnimationFrame(() => {
      focusNoteRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [focusNoteId, notes]);

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

  async function supprimer(noteId: string) {
    if (suppression) return;
    setSuppression(true);
    try {
      const res = await fetch(`/api/dashboard/voice-notes/${noteId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('delete');
      notifySuccess('Note supprimée');
      setNoteASupprimer(null);
      if (editingNoteId === noteId) setEditingNoteId(null);
      await load();
    } catch {
      notifyError("La note n'a pas pu être supprimée");
    } finally {
      setSuppression(false);
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
    <>
      <ul className="flex flex-col gap-2.5">
        {notes.map((note) => {
          const lienIci = note.liens.find((l) => l.entiteType === entiteType && l.entiteId === entiteId);
          const probable = lienIci?.confiance === 'probable';
          const mine = Boolean(viewerId && note.createdBy === viewerId);
          const resume = resumeCarteNote(note);
          return (
            <li
              key={note.id}
              ref={note.id === focusNoteId ? focusNoteRef : undefined}
              className={`scroll-m-6 rounded-xl border bg-[#F0F1F4] px-3 py-2.5 ${
                note.id === focusNoteId ? 'border-accent/40' : 'border-black/[0.06]'
              }`}
            >
              {note.author ? (
                <CollaborateurNom
                  portrait={note.author}
                  size={28}
                  className="mb-1.5 text-[13.5px] font-semibold text-text-strong"
                />
              ) : (
                <p className="mb-1.5 text-[13.5px] font-semibold text-text-strong">
                  {note.authorName?.trim() || 'Auteur inconnu'}
                </p>
              )}
              <div className="flex items-start justify-between gap-2">
                <p className="flex min-w-0 flex-wrap items-center gap-1.5 text-[11.5px] text-text-subtle">
                  <span>{formatDate(note.createdAt)}</span>
                  {note.sourceInfo ? <span>· {NOTE_SOURCE_LABELS[note.sourceInfo]}</span> : null}
                </p>
                <div className="flex shrink-0 items-center gap-1">
                  {lienIci ? (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10.5px] font-medium ${
                        probable ? 'bg-black/[0.06] text-text-muted' : 'bg-accent/10 text-accent'
                      }`}
                    >
                      {NOTE_CONFIANCE_LABELS[lienIci.confiance]}
                    </span>
                  ) : null}
                  {mine && peutSupprimer && noteASupprimer === note.id ? (
                    <span className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => void supprimer(note.id)}
                        disabled={suppression}
                        className="inline-flex min-h-8 items-center rounded-lg px-2 text-[11.5px] font-semibold text-red-700 hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:opacity-60"
                      >
                        {suppression ? 'Suppression…' : 'Supprimer'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setNoteASupprimer(null)}
                        disabled={suppression}
                        className="inline-flex min-h-8 items-center rounded-lg px-2 text-[11.5px] font-semibold text-text-muted hover:bg-black/[0.04] hover:text-text-strong"
                      >
                        Annuler
                      </button>
                    </span>
                  ) : mine ? (
                    <span className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setEditingNoteId(note.id)}
                        className="inline-flex min-h-8 items-center gap-1 rounded-lg px-2 text-[11.5px] font-semibold text-text-muted hover:bg-black/[0.04] hover:text-text-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                      >
                        <Pencil size={13} aria-hidden />
                        Modifier
                      </button>
                      {peutSupprimer ? (
                        <button
                          type="button"
                          onClick={() => setNoteASupprimer(note.id)}
                          className="inline-flex min-h-8 items-center rounded-lg px-2 text-[11.5px] font-semibold text-text-muted hover:bg-black/[0.04] hover:text-text-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                        >
                          Supprimer
                        </button>
                      ) : null}
                    </span>
                  ) : null}
                </div>
              </div>

              {resume.contact ? (
                <div className="mt-2">
                  <p className="flex items-center gap-1.5 text-[14px] font-semibold text-text-strong">
                    <UserRound size={15} className="shrink-0 text-text-muted" aria-hidden />
                    {resume.contact.nom ?? 'Nouveau contact'}
                  </p>
                  <div className="mt-1.5 grid gap-1 text-[12.5px] text-text-muted">
                    {resume.contact.telephone ? (
                      <p className="flex min-w-0 items-center gap-1.5" aria-label={`Téléphone ${resume.contact.telephone}`}>
                        <Phone size={13} className="shrink-0" aria-hidden />
                        <span className="truncate">{resume.contact.telephone}</span>
                      </p>
                    ) : null}
                    {resume.contact.email ? (
                      <p className="flex min-w-0 items-center gap-1.5" aria-label={`E-mail ${resume.contact.email}`}>
                        <Mail size={13} className="shrink-0" aria-hidden />
                        <span className="truncate">{resume.contact.email}</span>
                      </p>
                    ) : null}
                    {resume.contact.adresse ? (
                      <p className="flex min-w-0 items-start gap-1.5" aria-label={`Adresse ${resume.contact.adresse}`}>
                        <MapPin size={13} className="mt-0.5 shrink-0" aria-hidden />
                        <span className="line-clamp-2">{resume.contact.adresse}</span>
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : (
                <p className="mt-1.5 text-pretty text-[13.5px] leading-snug text-text">
                  {resume.texte}
                </p>
              )}

              {lienIci && !probable && entiteType !== 'parcelle' ? (
                <p className="mt-1.5 text-[11.5px] font-medium text-text-muted">
                  Rattachée à {entiteType === 'immeuble' ? 'une adresse' : LIBELLE_ENTITE[entiteType].toLowerCase()}
                </p>
              ) : null}
              {probable && lienIci ? (
                <div className="mt-2 flex flex-wrap gap-2">
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
                <div className="mt-2 flex items-center justify-between gap-3 border-t border-black/[0.05] pt-2">
                  <span className="text-[11.5px] font-medium text-text-muted">Partage</span>
                  <ChoixVisibilite
                    objet="note"
                    value={note.visibilite}
                    avecAide={false}
                    onChange={(next) => void patchVisibilite(note.id, next)}
                  />
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      {editingNoteId ? (
        <NoteFiche
          noteId={editingNoteId}
          onClose={() => setEditingNoteId(null)}
          onChanged={() => void load()}
        />
      ) : null}
    </>
  );
}
