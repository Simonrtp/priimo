import type { NotificationType } from './types';

export const LIEN_ADRESSES_A_REVOIR =
  '/dashboard/prospection?vue=carte&itineraire=1&fraicheur=a-revoir';

/** Chaque type a une destination. Une notification sans lien n'a pas lieu d'être. */
export function lienNotification(
  type: NotificationType,
  entiteId?: string | null,
): string {
  switch (type) {
    case 'leads_livres':
      return '/dashboard/prospection?filtre=non-pris&vue=liste';
    case 'leads_assignes':
      return entiteId
        ? `/dashboard/prospection?lead=${encodeURIComponent(entiteId)}`
        : '/dashboard/prospection?vue=liste';
    case 'contact_transfere':
      return entiteId
        ? `/dashboard/contacts/${encodeURIComponent(entiteId)}`
        : '/dashboard/contacts';
    case 'invitation_acceptee':
      return '/dashboard/settings?tab=team';
    case 'zone_modifiee':
      return '/dashboard/prospection?vue=carte';
    case 'estimation_consultee':
    case 'estimation_calculee':
      return entiteId
        ? `/dashboard/estimation/${encodeURIComponent(entiteId)}`
        : '/dashboard/estimation';
    case 'demande_estimation':
      return '/dashboard';
    case 'lead_portail':
      return '/dashboard';
    case 'note_transcrite':
      return '/dashboard?notes=1';
    case 'import_termine':
      return '/dashboard/contacts';
    case 'anniversaire':
      return '/dashboard/settings?tab=team';
    case 'negociateur_sans_activite':
      return entiteId
        ? `/dashboard?membre=${encodeURIComponent(entiteId)}`
        : '/dashboard';
    case 'zone_non_travaillee':
      return '/dashboard/prospection?vue=carte';
    case 'mandat_60_jours':
      return '/dashboard/biens?filtre=mandats-60j';
  }
}
