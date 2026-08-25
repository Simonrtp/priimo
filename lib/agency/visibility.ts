/**
 * Qui voit les contacts et les leads des collègues, *à l'intérieur* de
 * l'agence active. Ça ne touche jamais à l'isolation inter-agences :
 * un membre de A ne voit pas les données de B, quel que soit ce réglage.
 *
 * `own`     — un collaborateur ne voit que ce qui le concerne.
 *             Le directeur voit toute l'agence.
 * `agency`  — tous les membres voient les fiches de l'agence active.
 *
 * Bascule unique, à trancher avec l'agence partenaire. Les briques 2 et 3
 * lisent cette constante ; ne pas la dupliquer ailleurs.
 */
export type AgencyRecordVisibility = 'own' | 'agency';

export const AGENCY_RECORD_VISIBILITY: AgencyRecordVisibility = 'own';

export function collaboratorSeesColleaguesRecords(): boolean {
  return AGENCY_RECORD_VISIBILITY === 'agency';
}

export type RecordViewer = { id: string; role: 'directeur' | 'collaborateur' };

export function viewerFromProfile(profile: RecordViewer): RecordViewer {
  return { id: profile.id, role: profile.role };
}

export type OwnedRecord = {
  assignedTo: string | null;
  createdBy: string | null;
};

/** Propriétaire d'une fiche : l'assigné, sinon l'auteur. */
export function recordOwnerId(record: OwnedRecord): string | null {
  return record.assignedTo ?? record.createdBy;
}

/**
 * Contacts / notes : en mode strict, un collaborateur ne voit que ce qui
 * lui appartient. Le directeur voit toute l'agence. Jamais une autre agence.
 */
export function canSeeOwnedRecord(viewer: RecordViewer, record: OwnedRecord): boolean {
  if (viewer.role === 'directeur' || collaboratorSeesColleaguesRecords()) return true;
  return recordOwnerId(record) === viewer.id;
}

/**
 * Leads : la file non assignée reste visible (travail commun). Un lead
 * déjà attribué n'apparaît qu'à l'assigné — et au directeur.
 */
export function canSeeLeadRecord(
  viewer: RecordViewer,
  lead: { assignedTo: string | null },
): boolean {
  if (viewer.role === 'directeur' || collaboratorSeesColleaguesRecords()) return true;
  if (lead.assignedTo === null) return true;
  return lead.assignedTo === viewer.id;
}
