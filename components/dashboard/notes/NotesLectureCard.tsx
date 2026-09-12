'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Mic, NotebookPen, Unlink } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { useUser } from '@/lib/hooks/useUser';
import { FIELD } from '@/lib/today/field';
import { formatNoteWhen } from '@/lib/notes/format-when';
import { onNoteCreated } from '@/lib/notes/note-created-event';
import {
  estRattachee,
  LIBELLE_ENTITE,
  syntheseRattachement,
} from '@/lib/notes/rattachement';
import type { NoteLecture } from '@/lib/notes/lecture';

const PAPIER = '#F4EFE6';
const PAPIER_LIRE = '#FFF9F2';
const ENCRE = '#15202F';

function IconeSource({ vocale, surSombre = false }: { vocale: boolean; surSombre?: boolean }) {
  const Icone = vocale ? Mic : NotebookPen;
  return (
    <span
      className="flex size-8 shrink-0 items-center justify-center rounded-full"
      style={
        surSombre
          ? { backgroundColor: 'rgba(255,255,255,0.16)', color: '#fff' }
          : { backgroundColor: FIELD.ardoisePastel, color: FIELD.ardoise }
      }
      title={vocale ? 'Note vocale' : 'Note écrite'}
    >
      <Icone size={14} strokeWidth={2.2} aria-hidden />
      <span className="sr-only">{vocale ? 'Note vocale' : 'Note écrite'}</span>
    </span>
  );
}

function SqueletteListe() {
  return (
    <ul className="flex flex-col gap-2" aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <li key={i} className="squelette-bloc rounded-clay px-3 py-3" style={{ animationDelay: `${i * 40}ms` }}>
          <div className="squelette h-3.5 w-4/5 rounded-full" />
          <div className="squelette mt-2 h-3 w-2/5 rounded-full" />
        </li>
      ))}
    </ul>
  );
}

function LigneNote({
  note,
  active,
  onChoisir,
}: {
  note: NoteLecture;
  active: boolean;
  onChoisir: (id: string) => void;
}) {
  const rattachee = estRattachee(note.rattachements);
  return (
    <li>
      <button
        type="button"
        onClick={() => onChoisir(note.id)}
        aria-current={active ? 'true' : undefined}
        className={`flex w-full items-start gap-2.5 rounded-clay px-2.5 py-2.5 text-left ${
          active ? '' : 'hover:bg-black/[0.06]'
        }`}
        style={active ? { backgroundColor: ENCRE, color: '#fff' } : { color: ENCRE }}
      >
        <IconeSource vocale={note.hasAudio} surSombre={active} />
        <span className="min-w-0 flex-1">
          <span className={`line-clamp-2 text-pretty text-[14px] font-semibold ${active ? 'text-white' : ''}`}>
            {(note.transcript ?? '').trim() || 'Sans texte'}
          </span>
          <span
            className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[12.5px] font-medium"
            style={{ color: active ? 'rgba(255,255,255,0.78)' : FIELD.ardoise }}
          >
            <time dateTime={note.createdAt}>{formatNoteWhen(note.createdAt)}</time>
            {note.authorName ? <span>· {note.authorName}</span> : null}
            {rattachee ? (
              <span className="truncate">· {syntheseRattachement(note.rattachements)}</span>
            ) : (
              <span className={active ? 'font-semibold text-white' : 'font-semibold'} style={active ? undefined : { color: '#8A3D14' }}>
                · Non rattachée
              </span>
            )}
          </span>
        </span>
      </button>
    </li>
  );
}

export default function NotesLectureCard({
  noteIdInitial,
  membreId,
  onClose,
  onChoisir,
}: {
  noteIdInitial: string | null;
  membreId: string | null;
  onClose: () => void;
  onChoisir: (id: string | null) => void;
}) {
  const { profile } = useUser();
  const [notes, setNotes] = useState<NoteLecture[] | null>(null);
  const [erreur, setErreur] = useState(false);
  const [choisieId, setChoisieId] = useState<string | null>(noteIdInitial);

  useEffect(() => {
    setChoisieId(noteIdInitial);
  }, [noteIdInitial]);

  const charger = useCallback(
    async (signal?: AbortSignal) => {
      const params = new URLSearchParams({ scope: 'visibles' });
      if (membreId) params.set('membre', membreId);
      try {
        const res = await fetch(`/api/dashboard/notes/inbox?${params.toString()}`, { signal });
        const data = (await res.json()) as { notes?: NoteLecture[] };
        if (signal?.aborted) return;
        if (!res.ok) {
          setErreur(true);
          setNotes([]);
          return;
        }
        setErreur(false);
        setNotes(data.notes ?? []);
      } catch {
        if (signal?.aborted) return;
        setErreur(true);
        setNotes([]);
      }
    },
    [membreId],
  );

  useEffect(() => {
    const ac = new AbortController();
    setNotes(null);
    setErreur(false);
    void charger(ac.signal);
    return () => ac.abort();
  }, [charger]);

  useEffect(() => {
    return onNoteCreated(() => {
      void charger();
    });
  }, [charger]);

  const choisie = notes?.find((n) => n.id === choisieId) ?? null;
  const miennes = (notes ?? []).filter((n) => n.createdBy === profile.id);
  const publiees = (notes ?? []).filter((n) => n.createdBy !== profile.id);

  function choisir(id: string) {
    setChoisieId(id);
    onChoisir(id);
  }

  function revenir() {
    setChoisieId(null);
    onChoisir(null);
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Mes notes"
      description="Les vôtres, et celles que l’équipe a rendues visibles."
      maxWidth="2xl"
    >
      <div
        className="-mx-5 -mb-5 grid min-h-[22rem] gap-4 border-t px-5 py-5 md:grid-cols-[minmax(0,17.5rem)_1fr] md:items-stretch"
        style={{ backgroundColor: PAPIER, borderColor: 'rgba(21, 32, 47, 0.12)' }}
      >
        <div className={choisie ? 'hidden md:flex md:min-h-0 md:flex-col' : 'flex min-h-0 flex-col'}>
          {notes === null ? (
            <SqueletteListe />
          ) : erreur ? (
            <p className="text-pretty py-8 text-[13.5px] font-medium text-text-strong">
              Les notes n’ont pas pu être chargées. Fermez et réouvrez la carte.
            </p>
          ) : notes.length === 0 ? (
            <p className="text-pretty py-8 text-[13.5px] font-medium text-text-strong">
              Aucune note pour l’instant. Ajoutez-en depuis la carte Informations terrain.
            </p>
          ) : (
            <div className="flex min-h-0 flex-col gap-4 overflow-y-auto">
              {miennes.length > 0 ? (
                <section>
                  {publiees.length > 0 ? (
                    <h3 className="mb-1.5 px-1 font-semibold uppercase" style={{ fontSize: 11, color: FIELD.ardoise }}>
                      Les miennes
                    </h3>
                  ) : null}
                  <ul className="flex flex-col gap-1">
                    {miennes.map((note) => (
                      <LigneNote
                        key={note.id}
                        note={note}
                        active={note.id === choisieId}
                        onChoisir={choisir}
                      />
                    ))}
                  </ul>
                </section>
              ) : null}
              {publiees.length > 0 ? (
                <section>
                  <h3 className="mb-1.5 px-1 font-semibold uppercase" style={{ fontSize: 11, color: FIELD.ardoise }}>
                    Publiées par l’équipe
                  </h3>
                  <ul className="flex flex-col gap-1">
                    {publiees.map((note) => (
                      <LigneNote
                        key={note.id}
                        note={note}
                        active={note.id === choisieId}
                        onChoisir={choisir}
                      />
                    ))}
                  </ul>
                </section>
              ) : null}
            </div>
          )}
        </div>

        <div
          className={
            choisie
              ? 'flex min-h-0 flex-col rounded-clay p-4'
              : 'hidden md:flex md:items-center md:justify-center md:rounded-clay'
          }
          style={{ backgroundColor: PAPIER_LIRE }}
        >
          {choisie ? (
            <DetailNote note={choisie} onRetour={revenir} />
          ) : (
            <p className="text-pretty px-4 text-center text-[14px] font-medium" style={{ color: FIELD.ardoise }}>
              Choisissez une note pour la lire.
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}

function DetailNote({ note, onRetour }: { note: NoteLecture; onRetour: () => void }) {
  const rattachee = estRattachee(note.rattachements);
  const vocale = note.hasAudio;

  return (
    <article className="flex min-h-0 flex-col gap-4">
      <button
        type="button"
        onClick={onRetour}
        className="inline-flex min-h-10 items-center gap-1.5 self-start rounded-lg px-1 text-[13px] font-semibold md:hidden"
        style={{ color: FIELD.ardoise }}
      >
        <ArrowLeft size={16} aria-hidden />
        Toutes les notes
      </button>

      <header className="flex items-start gap-3">
        <IconeSource vocale={vocale} />
        <div className="min-w-0">
          <p className="text-[14px] font-semibold text-text-strong">
            {vocale ? 'Note vocale' : 'Note écrite'}
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[13px] font-medium" style={{ color: FIELD.ardoise }}>
            <time dateTime={note.createdAt}>{formatNoteWhen(note.createdAt)}</time>
            {note.authorName ? <span>· {note.authorName}</span> : null}
            {note.visibilite === 'privee' ? <span>· Privée</span> : <span>· Visible dans l’agence</span>}
          </p>
        </div>
      </header>

      <section>
        <h3 className="mb-2 font-semibold uppercase" style={{ fontSize: 11, color: FIELD.ardoise }}>
          La note
        </h3>
        <p className="whitespace-pre-wrap text-pretty text-[16px] leading-relaxed text-text-strong">
          {(note.transcript ?? '').trim() || 'Sans texte'}
        </p>
      </section>

      <section>
        <h3 className="mb-2 font-semibold uppercase" style={{ fontSize: 11, color: FIELD.ardoise }}>
          Rattachée à
        </h3>
        {rattachee ? (
          <ul className="flex flex-col gap-2">
            {note.rattachements.map((r) => {
              const corps = (
                <>
                  <span className="text-[11.5px] font-semibold uppercase" style={{ color: FIELD.ardoise }}>
                    {LIBELLE_ENTITE[r.type]}
                  </span>
                  <span className="mt-0.5 block truncate text-[14px] font-semibold text-text-strong">
                    {r.label}
                  </span>
                </>
              );
              return (
                <li key={`${r.type}:${r.id}`}>
                  {r.href ? (
                    <Link
                      href={r.href}
                      className="block rounded-clay border border-black/12 bg-white px-3.5 py-3 hover:bg-black/[0.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    >
                      {corps}
                    </Link>
                  ) : (
                    <div className="rounded-clay border border-black/12 bg-white px-3.5 py-3">{corps}</div>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <div
            className="flex items-start gap-2.5 rounded-clay border border-dashed px-3.5 py-3"
            style={{ borderColor: 'rgba(138, 61, 20, 0.35)', backgroundColor: 'rgba(232, 116, 60, 0.1)' }}
          >
            <Unlink size={16} strokeWidth={2} className="mt-0.5 shrink-0" style={{ color: '#8A3D14' }} aria-hidden />
            <div>
              <p className="text-[14px] font-semibold text-text-strong">Non rattachée</p>
              <p className="mt-0.5 text-pretty text-[13px] font-medium" style={{ color: '#8A3D14' }}>
                Cette note n’est liée à aucun contact, bien, prospect, immeuble ou parcelle.
              </p>
            </div>
          </div>
        )}
      </section>
    </article>
  );
}
