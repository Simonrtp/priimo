'use client';

import Link from 'next/link';
import { FIELD } from '@/lib/today/field';
import type { HomeNote } from '@/lib/notes/inbox';
import { formatNoteWhen } from '@/lib/notes/format-when';
import WorkspaceCard, { CardEyebrow } from '@/components/dashboard/workspace/WorkspaceCard';
import NoteCreateChooser from '@/components/dashboard/notes/NoteCreateChooser';

export default function RecentNotesCard({ notes }: { notes: readonly HomeNote[] }) {
  return (
    <WorkspaceCard>
      <div className="flex items-baseline justify-between gap-3">
        <CardEyebrow>Dernières notes</CardEyebrow>
        <Link
          href="/dashboard/notes"
          className="cursor-pointer rounded-md px-1.5 py-0.5 text-[12.5px] font-semibold text-text-strong underline decoration-black/25 underline-offset-2 hover:bg-black/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Toutes les notes
        </Link>
      </div>
      {notes.length === 0 ? (
        <div className="mt-3">
          <p className="text-pretty text-[13.5px] text-text-muted">
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
            return (
              <li key={note.id} className="group border-b border-black/[0.05] last:border-b-0">
                <Link
                  href={`/dashboard/notes?id=${encodeURIComponent(note.id)}`}
                  className="block cursor-pointer rounded-lg px-1.5 py-2.5 hover:bg-black/[0.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  <p className="line-clamp-2 text-pretty text-[13.5px] text-text group-hover:line-clamp-none group-hover:whitespace-pre-wrap group-focus-within:line-clamp-none group-focus-within:whitespace-pre-wrap">
                    {(note.transcript ?? '').trim() || 'Sans transcription'}
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-text-muted">
                    <time dateTime={note.createdAt}>{formatNoteWhen(note.createdAt)}</time>
                    <span className={attached ? '' : 'text-text-subtle'}>
                      {note.attachmentLabel ?? 'non rattachée'}
                    </span>
                    {note.statut === 'brute' ? (
                      <span
                        className="inline-block size-1.5 rounded-full"
                        style={{ background: FIELD.ardoise }}
                        title="Note brute"
                      />
                    ) : null}
                    {!attached ? (
                      <span
                        className="hidden font-semibold group-hover:inline group-focus-within:inline"
                        style={{ color: FIELD.ardoise }}
                      >
                        Rattacher
                      </span>
                    ) : null}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </WorkspaceCard>
  );
}
