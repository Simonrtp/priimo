import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { couleurMembreLibre } from './couleurs-membres';

/**
 * Donne une couleur aux collaborateurs qui n'en ont pas encore, sans jamais
 * en reprendre une déjà prise dans l'agence. Client service role : un agent
 * n'écrit pas dans les adhésions de ses collègues. Avant la migration du
 * 26/10/2026, la colonne n'existe pas : on ne fait rien.
 */
export async function assurerCouleursMembres(
  admin: SupabaseClient,
  agencyId: string,
  profileIds: readonly string[],
): Promise<Map<string, string>> {
  const couleurs = new Map<string, string>();
  const { data, error } = await admin
    .from('profile_agencies')
    .select('profile_id, couleur')
    .eq('agency_id', agencyId);
  if (error) return couleurs;
  for (const l of (data ?? []) as { profile_id: string; couleur: string | null }[]) {
    if (l.couleur) couleurs.set(l.profile_id, l.couleur);
  }
  const membres = new Set(((data ?? []) as { profile_id: string }[]).map((l) => l.profile_id));

  for (const id of profileIds) {
    if (couleurs.has(id) || !membres.has(id)) continue;
    // Deux essais : un collègue peut prendre la même couleur au même instant.
    for (let essai = 0; essai < 2; essai += 1) {
      const couleur = couleurMembreLibre([...couleurs.values()]);
      const { error: e } = await admin
        .from('profile_agencies')
        .update({ couleur })
        .eq('agency_id', agencyId)
        .eq('profile_id', id)
        .is('couleur', null);
      if (!e) {
        couleurs.set(id, couleur);
        break;
      }
      const { data: relu } = await admin
        .from('profile_agencies')
        .select('profile_id, couleur')
        .eq('agency_id', agencyId);
      for (const l of (relu ?? []) as { profile_id: string; couleur: string | null }[]) {
        if (l.couleur) couleurs.set(l.profile_id, l.couleur);
      }
      if (couleurs.has(id)) break;
    }
  }
  return couleurs;
}
