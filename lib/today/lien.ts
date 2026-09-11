import { lienLectureNote } from '@/lib/notes/lecture';
import type { TodayCardAction } from '@/lib/today/cards';

/**
 * Destination d'une action de carte, pour les rendus serveur.
 *
 * Mêmes routes que la navigation cliente de `TodayCardView`. Null quand
 * l'action n'a pas d'écran dédié : l'appelant n'affiche alors pas de bouton.
 */
export function lienAction(action: TodayCardAction): string | null {
  switch (action.kind) {
    case 'appeler':
      return `tel:${action.phone.replace(/\s+/g, '')}`;
    case 'ouvrir_contact':
      return `/dashboard/contacts?fiche=${action.contactId}`;
    case 'ouvrir_lead':
      return `/dashboard/prospection?lead=${action.leadId}`;
    case 'voir_acquereurs':
    case 'ouvrir_bien':
      return `/dashboard/biens?fiche=${action.bienId}`;
    case 'ouvrir_liste':
      return `/dashboard?filtre=${action.cardType}`;
    case 'ouvrir_estimation':
      return `/dashboard/estimation?historique=1&id=${action.estimationId}`;
    case 'ouvrir_note':
      return lienLectureNote(action.noteId);
    case 'ouvrir_promesse':
    case 'ouvrir_rdv':
      return null;
  }
}
