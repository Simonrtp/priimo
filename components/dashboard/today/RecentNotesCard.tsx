'use client';

import type { ReactNode } from 'react';
import { ArrowRight, MapPin } from 'lucide-react';
import { FIELD } from '@/lib/today/field';
import type { HomeNote } from '@/lib/notes/inbox';
import { formatNoteWhen } from '@/lib/notes/format-when';
import { lienLectureNote } from '@/lib/notes/lecture';
import { useNotesLectureOptional } from '@/components/dashboard/notes/NotesLectureProvider';
import NoteCreateChooser from '@/components/dashboard/notes/NoteCreateChooser';

const CARTE =
  'flex flex-col rounded-clay-lg bg-white px-4 py-4 text-ink shadow-clay sm:px-5 sm:py-5';

export default function RecentNotesCard({
  notes,
  className = '',
}: {
  notes: readonly HomeNote[];
  className?: string;
}) {
  const lecture = useNotesLectureOptional();

  function ouvrir(id?: string) {
    if (lecture) lecture.ouvrir(id ?? null);
    else window.location.assign(lienLectureNote(id));
  }

  if (notes.length === 0) {
    return (
      <Puits className={className}>
        <Entete onToutes={() => ouvrir()} />
        <div className="mt-3">
          <p className="text-pretty text-[13.5px] font-medium text-text-strong">
            Aucune note dictée cette semaine
          </p>
          <div className="mt-3">
            <NoteCreateChooser variant="toolbar" />
          </div>
        </div>
      </Puits>
    );
  }

  return (
    <div className={`relative min-w-0 ${className}`}>
      {/* Calibre au repos : la grille s’aligne dessus. La carte vraie
          s’allonge au survol sans pousser la voisine. */}
      <div className="pointer-events-none invisible [@media(hover:none)]:hidden" aria-hidden>
        <Puits>
          <Entete calibre />
          <Liste notes={notes} calibre />
        </Puits>
      </div>
      <div className="h-full [@media(hover:hover)]:absolute [@media(hover:hover)]:inset-x-0 [@media(hover:hover)]:top-0 [@media(hover:hover)]:z-20 [@media(hover:hover)]:h-auto [@media(hover:hover)]:min-h-full">
        <Puits className="min-h-full">
          <Entete onToutes={() => ouvrir()} />
          <Liste notes={notes} onOuvrir={ouvrir} />
        </Puits>
      </div>
    </div>
  );
}

function Puits({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`${CARTE} ${className}`}>
      {children}
    </div>
  );
}

function Entete({
  onToutes,
  calibre = false,
}: {
  onToutes?: () => void;
  calibre?: boolean;
}) {
  return (
    <div className="flex shrink-0 items-baseline justify-between gap-3">
      <p className="font-semibold uppercase" style={{ fontSize: 11, color: FIELD.ardoise }}>
        Dernières notes
      </p>
      {calibre ? (
        <span
          className="rounded-md px-1.5 py-0.5 text-[12.5px] font-semibold underline underline-offset-2"
          style={{ color: FIELD.ardoise, textDecorationColor: FIELD.ardoise }}
        >
          Toutes les notes
        </span>
      ) : (
        <button
          type="button"
          onClick={onToutes}
          className="cursor-pointer rounded-md px-1.5 py-0.5 text-[12.5px] font-semibold underline underline-offset-2 hover:bg-black/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          style={{ color: FIELD.ardoise, textDecorationColor: FIELD.ardoise }}
        >
          Toutes les notes
        </button>
      )}
    </div>
  );
}

function titreNote(note: HomeNote): string {
  const nom = note.attachmentLabel?.trim();
  if (nom) return nom;
  const premiere = (note.transcript ?? '').trim().split('\n', 1)[0]?.replace(/\s+/g, ' ') ?? '';
  return premiere || 'Note';
}

function Liste({
  notes,
  onOuvrir,
  calibre = false,
}: {
  notes: readonly HomeNote[];
  onOuvrir?: (id: string) => void;
  calibre?: boolean;
}) {
  return (
    <ul className="mt-3 flex flex-col">
      {notes.map((note) => {
        const attached = Boolean(note.attachmentLabel);
        const titre = titreNote(note);
        const texte = (note.transcript ?? '').trim() || 'Sans transcription';
        const corps = (
          <>
            <span className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-text-strong">
                {titre}
              </span>
              <ArrowRight
                size={15}
                strokeWidth={2.2}
                aria-hidden
                className={`shrink-0 text-text-subtle transition-transform duration-fluid ease-soft motion-reduce:transition-none ${
                  calibre
                    ? ''
                    : 'group-hover/note:rotate-90 group-focus-within/note:rotate-90'
                }`}
              />
            </span>
            <span
              className={`fluid-collapse motion-reduce:transition-none ${
                calibre
                  ? 'grid-rows-[0fr]'
                  : 'grid-rows-[0fr] group-hover/note:grid-rows-[1fr] group-focus-within/note:grid-rows-[1fr]'
              }`}
            >
              <span>
                <span className="mt-2 block text-pretty text-[13px] font-medium leading-snug text-text-strong whitespace-pre-wrap">
                  {texte}
                </span>
                <span
                  className="mt-1.5 flex flex-wrap items-center gap-2 text-[12.5px] font-medium"
                  style={{ color: FIELD.ardoise }}
                >
                  <time dateTime={note.createdAt}>{formatNoteWhen(note.createdAt)}</time>
                  <span
                    className="inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-semibold"
                    style={
                      attached
                        ? { backgroundColor: 'rgba(30, 49, 72, 0.1)', color: '#15202F' }
                        : { backgroundColor: 'rgba(232, 116, 60, 0.16)', color: '#8A3D14' }
                    }
                  >
                    {note.attachmentKind ? (
                      <MapPin size={11} strokeWidth={2.4} className="shrink-0" aria-hidden />
                    ) : null}
                    {note.attachmentLabel ?? 'Non rattachée'}
                  </span>
                  {note.statut === 'brute' ? (
                    <span
                      className="inline-block size-2 rounded-full"
                      style={{ background: FIELD.ardoise }}
                      title="Note brute"
                    />
                  ) : null}
                  {!attached && !calibre ? (
                    <span className="font-semibold">Rattacher</span>
                  ) : null}
                </span>
              </span>
            </span>
          </>
        );

        return (
          <li
            key={note.id}
            className="group/note relative z-0 border-b border-black/[0.06] last:border-b-0 hover:z-20 focus-within:z-20"
          >
            {calibre ? (
              <div className="px-1.5 py-3">{corps}</div>
            ) : (
              <button
                type="button"
                onClick={() => onOuvrir?.(note.id)}
                className="block w-full cursor-pointer rounded-lg px-1.5 py-3 text-left transition-colors duration-fluid ease-soft hover:bg-black/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transition-none"
              >
                {corps}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
