import type { Contact } from '@/types/contact';
import type { Lead } from '@/types/lead';
import {
  canSeeLeadRecord,
  canSeeOwnedRecord,
  type RecordViewer,
} from '@/lib/agency/visibility';
import { canSeeVoiceNote } from '@/lib/notes/visibility';

export function visibleContactsFor(viewer: RecordViewer, contacts: readonly Contact[]): Contact[] {
  return contacts.filter((c) =>
    canSeeOwnedRecord(viewer, { assignedTo: c.assignedTo, createdBy: c.createdBy }),
  );
}

export function visibleLeadsFor(viewer: RecordViewer, leads: readonly Lead[]): Lead[] {
  return leads.filter((l) => canSeeLeadRecord(viewer, { assignedTo: l.assignedTo }));
}

export function visibleBiensFor<T extends { createdBy: string | null }>(
  viewer: RecordViewer,
  biens: readonly T[],
): T[] {
  return biens.filter((b) => canSeeOwnedRecord(viewer, { assignedTo: null, createdBy: b.createdBy }));
}

export function visibleVoiceNotesFor<
  T extends { visibilite?: 'agence' | 'privee'; createdBy: string | null },
>(viewer: RecordViewer, notes: readonly T[]): T[] {
  return notes.filter((n) =>
    canSeeVoiceNote(viewer, {
      visibilite: n.visibilite ?? 'agence',
      createdBy: n.createdBy,
    }),
  );
}
