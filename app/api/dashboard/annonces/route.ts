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
  const annonces = await lireAnnonces(supabase);
  return NextResponse.json({ annonces });
}
