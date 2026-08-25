import type { NoteLienRow } from '@/types/database';
import type { NoteLien } from '@/types/contact';

export function mapDbNoteLien(row: NoteLienRow): NoteLien {
  return {
    id: row.id,
    noteId: row.note_id,
    agencyId: row.agency_id,
    entiteType: row.entite_type,
    entiteId: row.entite_id,
    confiance: row.confiance,
    creePar: row.cree_par,
    creeLe: row.cree_le,
  };
}

export const NOTE_LIENS_SELECT =
  'id, note_id, agency_id, entite_type, entite_id, confiance, cree_par, cree_le';
