import type { VoiceNote } from '@/types/contact';
import type { RattachementAffiche } from '@/lib/notes/rattachement';

export type NoteLecture = VoiceNote & {
  authorName: string | null;
  rattachements: RattachementAffiche[];
};

/** Destination unique : la lecture se fait sur l'accueil, plus sur une page. */
export function lienLectureNote(noteId?: string | null): string {
  const id = noteId?.trim();
  return id ? `/dashboard?notes=${encodeURIComponent(id)}` : '/dashboard?notes=1';
}
