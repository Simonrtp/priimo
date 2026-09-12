import { revalidatePath } from 'next/cache';

/**
 * Invalide les écrans dashboard concernés par une écriture.
 * Chemins fixes — jamais dérivés d'un agency_id (le HTML n'est pas
 * dans le Full Route Cache partagé : cookies() force le rendu par session).
 */
export function invaliderAccueilEtProspection(): void {
  revalidatePath('/dashboard');
  revalidatePath('/dashboard/prospection');
}

export function invaliderEstimation(): void {
  revalidatePath('/dashboard/estimation');
  // L'Accueil affiche aussi les estimations vues / demandes.
  revalidatePath('/dashboard');
}

export function invaliderContacts(): void {
  revalidatePath('/dashboard/contacts');
}

export function invaliderNotesAccueil(): void {
  revalidatePath('/dashboard');
}
