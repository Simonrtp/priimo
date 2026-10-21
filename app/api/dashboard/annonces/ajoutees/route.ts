import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { lireAnnoncesAjoutees } from '@/lib/annonces/lire';

/** Les annonces que l'agence a ajoutées par leur URL : toujours sur la carte, bureau, téléphone et tournée. */
export async function GET() {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }
  const supabase = await createSupabaseServerClient();
  const annonces = (await lireAnnoncesAjoutees(supabase)).map((a) => ({ ...a, raisonsLocalisation: [] }));
  return NextResponse.json({ annonces });
}
