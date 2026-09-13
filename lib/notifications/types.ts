/**
 * Ce qui s'est passé — pas ce qu'il y a à faire.
 *
 * Une tâche (on peut la FAIRE) vit sur l'Accueil. Une notification (on peut
 * seulement la LIRE) vit dans la cloche. Jamais les deux.
 */

export const NOTIFICATION_TYPES = [
  'leads_livres',
  'leads_assignes',
  'contact_transfere',
  'invitation_acceptee',
  'zone_modifiee',
  'estimation_consultee',
  'demande_estimation',
  'lead_portail',
  'note_transcrite',
  'estimation_calculee',
  'import_termine',
  'anniversaire',
  'negociateur_sans_activite',
  'zone_non_travaillee',
  'mandat_60_jours',
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/**
 * Types du modèle qui ne s'écrivent jamais.
 *
 * `demande_estimation` / `lead_portail` / `estimation_consultee` : l'Accueil
 * les porte déjà comme des tâches (appeler, ouvrir). Les dupliquer ici ferait
 * ignorer une des deux listes.
 *
 * `estimation_calculee` / `import_termine` : l'auteur vient de le faire.
 */
export const TYPES_NON_GENERES = [
  'demande_estimation',
  'lead_portail',
  'estimation_consultee',
  'estimation_calculee',
  'import_termine',
] as const;

export type TypeNonGenere = (typeof TYPES_NON_GENERES)[number];

export function estTypeNotification(v: unknown): v is NotificationType {
  return typeof v === 'string' && (NOTIFICATION_TYPES as readonly string[]).includes(v);
}

export type NotificationEntiteType =
  | 'lead'
  | 'contact'
  | 'zone'
  | 'note'
  | 'estimation'
  | 'bien'
  | 'profil'
  | 'agence';

export type Notification = {
  id: string;
  agencyId: string;
  profileId: string;
  type: NotificationType;
  titre: string;
  corps: string;
  lien: string;
  entiteType: NotificationEntiteType | null;
  entiteId: string | null;
  lueLe: string | null;
  groupeCle: string | null;
  createdAt: string;
};

export type NotificationInsert = {
  agencyId: string;
  profileId: string;
  type: NotificationType;
  titre: string;
  corps: string;
  lien: string;
  entiteType?: NotificationEntiteType | null;
  entiteId?: string | null;
  groupeCle?: string | null;
  /** Si égal au destinataire, on n'écrit rien : il le sait, il vient de le faire. */
  actorId?: string | null;
};

export const FENETRE_GROUPE_MS = 2 * 60 * 60 * 1000;
export const RETENTION_LUES_JOURS = 30;

export function destinataireValide(profileId: string, actorId?: string | null): boolean {
  if (!profileId) return false;
  if (actorId && actorId === profileId) return false;
  return true;
}
