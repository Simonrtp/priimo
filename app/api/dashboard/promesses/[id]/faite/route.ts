import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/**
 * Une tâche faite (« Rappeler Janine ») quitte l'accueil pour de bon.
 *
 * On passe la promesse à `faite` plutôt que de masquer la carte : le brief du
 * matin et les automatisations lisent les promesses `a_faire`, elles ne
 * doivent plus la rappeler.
 */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: 'Tâche inconnue' }, { status: 400 });

  // La RLS garde l'agence ; le profil, lui, se vérifie ici : on ne coche que
  // ses propres tâches.
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('promesses')
    .update({ statut: 'faite' })
    .eq('id', id)
    .eq('agency_id', agency.id)
    .eq('profile_id', profile.id)
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('[promesses/faite]', error);
    return NextResponse.json({ error: 'Enregistrement impossible' }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: 'Tâche inconnue' }, { status: 404 });

  return NextResponse.json({ ok: true });
}
