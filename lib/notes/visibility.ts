import type { RecordViewer } from '@/lib/agency/visibility';
import type { VoiceNoteVisibilite } from '@/types/contact';

export type VoiceNoteVisibilityFields = {
  visibilite: VoiceNoteVisibilite;
  createdBy: string | null;
};

/**
 * Une note 'agence' est lisible par toute l'agence.
 * Une note 'privee' est lisible par son auteur, et par le directeur :
 * il doit voir chaque note, et savoir qui l'a écrite.
 * Un collaborateur ne lit pas les notes privées des autres.
 * L'isolation inter-agences est ailleurs (agency_id / RLS).
 */
export function canSeeVoiceNote(
  viewer: RecordViewer,
  note: VoiceNoteVisibilityFields,
): boolean {
  if (viewer.role === 'directeur') return true;
  if (note.visibilite === 'privee') return note.createdBy === viewer.id;
  return true;
}
