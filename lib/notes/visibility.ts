import type { RecordViewer } from '@/lib/agency/visibility';
import type { VoiceNoteVisibilite } from '@/types/contact';

export type VoiceNoteVisibilityFields = {
  visibilite: VoiceNoteVisibilite;
  createdBy: string | null;
};

/**
 * Une note 'agence' est lisible par toute l'agence.
 * Une note 'privee' n'est lisible que par son auteur — y compris un directeur.
 * L'isolation inter-agences est ailleurs (agency_id / RLS).
 */
export function canSeeVoiceNote(
  viewer: RecordViewer,
  note: VoiceNoteVisibilityFields,
): boolean {
  if (note.visibilite === 'privee') return note.createdBy === viewer.id;
  return true;
}
