'use client';

import { FIELD } from '@/lib/today/field';
import type { HomeNote } from '@/lib/notes/inbox';
import { formatNoteWhen } from '@/lib/notes/format-when';
import { lienLectureNote } from '@/lib/notes/lecture';
import { useNotesLectureOptional } from '@/components/dashboard/notes/NotesLectureProvider';
import AccueilCard from './AccueilCard';
import NoteCreateChooser from '@/components/dashboard/notes/NoteCreateChooser';

export default function RecentNotesCard({ notes }: { notes: readonly HomeNote[] }) {
  const lecture = useNotesLectureOptional();

  function ouvrir(id?: string) {
    if (lecture) lecture.ouvrir(id ?? null);
    else window.location.assign(lienLectureNote(id));
  }

  return (
    <AccueilCard accent="creme" className="text-ink">
      <div className="flex items-baseline justify-between gap-3">
        <p
          className="font-semibold uppercase"
          style={{ fontSize: 11, color: FIELD.ardoise }}
        >
          Dernières notes
        </p>
        <button
          type="button"
          onClick={() => ouvrir()}
          className="cursor-pointer rounded-md px-1.5 py-0.5 text-[12.5px] font-semibold underline underline-offset-2 hover:bg-black/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          style={{ color: FIELD.ardoise, textDecorationColor: FIELD.ardoise }}
        >
          Toutes les notes
        </button>
      </div>
      {notes.length === 0 ? (
        <div className="mt-3">
          <p className="text-pretty text-[13.5px] font-medium text-text-strong">
            Aucune note dictée cette semaine
          </p>
          <div className="mt-3">
            <NoteCreateChooser variant="toolbar" />
          </div>
        </div>
      ) : (
        <ul className="mt-3 flex flex-col">
          {notes.map((note) => {
            const attached = Boolean(note.attachmentLabel);
            const texte = (note.transcript ?? '').trim() || 'Sans transcription';
            return (
              <li
                key={note.id}
                className="group border-b border-black/15 last:border-b-0"
              >
                <button
                  type="button"
                  onClick={() => ouvrir(note.id)}
                  className="block w-full cursor-pointer rounded-lg px-1.5 py-3 text-left hover:bg-black/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  <p className="line-clamp-2 text-pretty text-[14px] font-medium leading-snug text-text-strong group-hover:line-clamp-none group-hover:whitespace-pre-wrap group-focus-within:line-clamp-none group-focus-within:whitespace-pre-wrap">
                    {texte}
                  </p>
                  <p
                    className="mt-1.5 flex flex-wrap items-center gap-2 text-[12.5px] font-medium"
                    style={{ color: FIELD.ardoise }}
                  >
                    <time dateTime={note.createdAt}>{formatNoteWhen(note.createdAt)}</time>
                    <span
                      className="inline-flex max-w-full items-center rounded-full px-2 py-0.5 text-[11.5px] font-semibold"
                      style={
                        attached
                          ? { backgroundColor: 'rgba(30, 49, 72, 0.1)', color: '#15202F' }
                          : { backgroundColor: 'rgba(232, 116, 60, 0.16)', color: '#8A3D14' }
                      }
                    >
                      {note.attachmentLabel ?? 'Non rattachée'}
                    </span>
                    {note.statut === 'brute' ? (
                      <span
                        className="inline-block size-2 rounded-full"
                        style={{ background: FIELD.ardoise }}
                        title="Note brute"
                      />
                    ) : null}
                    {!attached ? (
                      <span className="hidden font-semibold group-hover:inline group-focus-within:inline">
                        Rattacher
                      </span>
                    ) : null}
                  </p>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </AccueilCard>
  );
}
