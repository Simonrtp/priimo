'use client';

import type { ReactNode } from 'react';
import { MapPin } from 'lucide-react';
import { FIELD } from '@/lib/today/field';
import type { HomeNote } from '@/lib/notes/inbox';
import { formatNoteWhen } from '@/lib/notes/format-when';
import { lienLectureNote } from '@/lib/notes/lecture';
import { useNotesLectureOptional } from '@/components/dashboard/notes/NotesLectureProvider';
import NoteCreateChooser from '@/components/dashboard/notes/NoteCreateChooser';
import CarteVideAccueil from '@/components/dashboard/accueil/CarteVideAccueil';
import CollaborateurNom from '@/components/dashboard/CollaborateurNom';
import PanneauAlerte from '@/components/ui/PanneauAlerte';

const CARTE =
  'flex flex-col rounded-clay-lg bg-white px-4 py-4 text-ink shadow-clay sm:px-5 sm:py-5';

const ETAPES_VIDE = [
  'On dicte en marchant. La note est déjà écrite.',
  'On rattache à une adresse, ou plus tard.',
  'Rien à ressaisir le soir.',
] as const;

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
      <CarteVideAccueil
        className={className}
        titre="Dernières notes"
        etapes={ETAPES_VIDE}
        icone="/noter.png"
        action={<NoteCreateChooser variant="toolbar" />}
      />
    );
  }

  return (
    <div className={`relative min-w-0 ${className}`}>
      <Puits className="min-h-full">
        <Entete onToutes={() => ouvrir()} />
        <Liste notes={notes} onOuvrir={ouvrir} />
      </Puits>
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

function Entete({ onToutes }: { onToutes?: () => void }) {
  return (
    <div className="flex shrink-0 items-baseline justify-between gap-3">
      <p className="font-semibold uppercase" style={{ fontSize: 11, color: FIELD.ardoise }}>
        Dernières notes
      </p>
      <button
        type="button"
        onClick={onToutes}
        className="cursor-pointer rounded-md px-1.5 py-0.5 text-[12.5px] font-semibold underline underline-offset-2 hover:bg-black/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        style={{ color: FIELD.ardoise, textDecorationColor: FIELD.ardoise }}
      >
        Toutes les notes
      </button>
    </div>
  );
}

function Liste({
  notes,
  onOuvrir,
}: {
  notes: readonly HomeNote[];
  onOuvrir?: (id: string) => void;
}) {
  return (
    <ul className="mt-3 flex max-h-[36rem] flex-col overflow-y-auto">
      {notes.map((note) => {
        const attached = Boolean(note.attachmentLabel);
        const texte = (note.transcript ?? '').trim() || 'Sans texte';
        const auteur = note.author;
        return (
          <li key={note.id} className="border-b border-black/[0.06] last:border-b-0">
            <button
              type="button"
              onClick={() => onOuvrir?.(note.id)}
              className="block w-full cursor-pointer rounded-lg px-1.5 py-3 text-left transition-colors duration-fluid ease-soft hover:bg-black/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transition-none"
            >
              {auteur ? (
                <CollaborateurNom
                  portrait={auteur}
                  size={28}
                  className="text-[14px] font-semibold text-text-strong"
                />
              ) : (
                <span className="text-[14px] font-semibold text-text-strong">Auteur inconnu</span>
              )}
              <span className="mt-1.5 block whitespace-pre-wrap text-pretty text-[13.5px] leading-snug text-text">
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
                      ? { backgroundColor: 'rgba(26, 42, 86, 0.1)', color: '#1A2A56' }
                      : { backgroundColor: 'rgba(232, 116, 60, 0.16)', color: '#8A3D14' }
                  }
                >
                  {note.attachmentKind ? (
                    <MapPin size={11} strokeWidth={2.4} className="shrink-0" aria-hidden />
                  ) : (
                    <PanneauAlerte size={12} label={null} />
                  )}
                  {note.attachmentLabel ?? 'Non rattachée'}
                </span>
                {note.visibilite === 'privee' ? <span>Privée</span> : null}
                {!attached ? <span className="font-semibold">Rattacher</span> : null}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
