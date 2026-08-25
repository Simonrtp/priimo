import type { NoteLienConfiance, NoteLienEntite } from '@/types/contact';
import { transcriptMentions } from '@/lib/notes/match';

export type OrphanNote = {
  id: string;
  agencyId: string;
  transcript: string | null;
  liens: readonly { entiteType: NoteLienEntite; entiteId: string }[];
};

export type NewEntityForReconcile = {
  agencyId: string;
  entiteType: Extract<NoteLienEntite, 'contact' | 'bien'>;
  entiteId: string;
  needles: readonly (string | null | undefined)[];
};

export type ReconcileProposal = {
  noteId: string;
  agencyId: string;
  entiteType: Extract<NoteLienEntite, 'contact' | 'bien'>;
  entiteId: string;
  confiance: NoteLienConfiance;
  creePar: 'reconciliation';
};

/**
 * Notes orphelines de l'agence dont la transcription contient le nom,
 * le téléphone ou l'adresse de la nouvelle fiche. Toujours 'probable'.
 */
export function proposeReconciliation(
  notes: readonly OrphanNote[],
  entity: NewEntityForReconcile,
): ReconcileProposal[] {
  const out: ReconcileProposal[] = [];
  for (const note of notes) {
    if (note.agencyId !== entity.agencyId) continue;
    if (!note.transcript?.trim()) continue;
    const already = note.liens.some(
      (l) => l.entiteType === entity.entiteType && l.entiteId === entity.entiteId,
    );
    if (already) continue;
    const linkedToSameKind = note.liens.some((l) => l.entiteType === entity.entiteType);
    if (linkedToSameKind) continue;
    if (!transcriptMentions(note.transcript, entity.needles)) continue;
    out.push({
      noteId: note.id,
      agencyId: entity.agencyId,
      entiteType: entity.entiteType,
      entiteId: entity.entiteId,
      confiance: 'probable',
      creePar: 'reconciliation',
    });
  }
  return out;
}
