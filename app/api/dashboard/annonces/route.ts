import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { lireAnnonces } from '@/lib/annonces/lire';

export async function GET() {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }
  const supabase = await createSupabaseServerClient();
  // Les raisons de localisation arrivent avec le détail (volet) : la liste reste légère.
  const annonces = (await lireAnnonces(supabase)).map((a) => ({ ...a, raisonsLocalisation: [] }));
  return NextResponse.json({ annonces });
}
