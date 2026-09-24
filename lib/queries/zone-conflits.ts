/**
 * Un recouvrement se voit sur la carte (hachures). On n’en fait plus une
 * alerte Accueil : le négociateur l’a déjà sous les yeux en dessinant.
 */
export async function signalerChevauchementsSiBesoin(_params: {
  supabase: unknown;
  agencyId: string;
  createdBy: string;
  zoneId: string;
}): Promise<void> {}
