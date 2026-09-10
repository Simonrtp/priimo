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
 * Chiffres d'activité d'un collaborateur.
 *
 * Volontairement plus strict que `canSeeOwnedRecord` : `AGENCY_RECORD_VISIBILITY`
 * ne s'applique pas ici. Voir la fiche d'un collègue et voir sa performance ne
 * sont pas la même autorisation — ouvrir la seconde parce que la première est
 * ouverte transformerait l'Accueil en tableau de comparaison entre collègues.
 * Un collaborateur voit les siens, un directeur voit ceux de son agence.
 */
export function canSeeActivityOf(viewer: RecordViewer, profileId: string): boolean {
  if (viewer.role === 'directeur') return true;
  return viewer.id === profileId;
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

/** Ce qu'il faut pour décider qui touche à une zone. */
export type ZonePourDroit = {
  assignedTo: string | null;
  verrouillee: boolean;
};

/** Le négociateur crée SA zone. Le directeur en crée pour n'importe qui. */
export function canCreateZone(viewer: RecordViewer, assignedTo: string | null): boolean {
  if (viewer.role === 'directeur') return true;
  return assignedTo === viewer.id;
}

/**
 * Modifier le contour ou le nom. Le directeur toujours. Le titulaire, tant
 * que la direction n'a pas verrouillé.
 */
export function canEditZone(viewer: RecordViewer, zone: ZonePourDroit): boolean {
  if (viewer.role === 'directeur') return true;
  if (zone.verrouillee) return false;
  return zone.assignedTo === viewer.id;
}

/** Verrouiller, réattribuer, désactiver, supprimer : direction seulement. */
export function canManageZone(viewer: RecordViewer): boolean {
  return viewer.role === 'directeur';
}
