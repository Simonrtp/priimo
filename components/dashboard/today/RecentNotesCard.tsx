'use client';

import Link from 'next/link';
import type { VoiceNote } from '@/types/contact';
import { formatNoteWhen } from '@/lib/notes/format-when';
import WorkspaceCard, { CardEyebrow } from '@/components/dashboard/workspace/WorkspaceCard';

function excerpt(text: string | null): string {
  const t = (text ?? '').trim().replace(/\s+/g, ' ');
  if (!t) return 'Sans transcription';
  return t;
}

export default function RecentNotesCard({ notes }: { notes: readonly VoiceNote[] }) {
  return (
    <WorkspaceCard>
      <div className="flex items-baseline justify-between gap-3">
        <CardEyebrow>Dernières notes</CardEyebrow>
        <Link
          href="/dashboard/notes"
          className="text-[12.5px] font-semibold text-text-strong underline decoration-black/25 underline-offset-2"
        >
          Toutes les notes
        </Link>
      </div>
      {notes.length === 0 ? (
        <p className="mt-3 text-pretty text-[13.5px] text-text-muted">
          Aucune note pour le moment. Une dictée apparaît ici dès qu&apos;elle est enregistrée.
        </p>
      ) : (
        <ul className="mt-3 flex flex-col">
          {notes.map((note) => (
            <li key={note.id} className="border-b border-black/[0.05] last:border-b-0">
              <Link
                href={`/dashboard/notes?id=${encodeURIComponent(note.id)}`}
                className="block rounded-lg py-2.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <p className="line-clamp-2 text-pretty text-[13.5px] text-text">{excerpt(note.transcript)}</p>
                <p className="mt-1 flex items-center gap-2 text-[12px] text-text-muted">
                  <time dateTime={note.createdAt}>{formatNoteWhen(note.createdAt)}</time>
                  {note.statut === 'brute' ? (
                    <span className="inline-block size-1.5 rounded-full bg-text-muted" title="Note brute" />
                  ) : null}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </WorkspaceCard>
  );
}
