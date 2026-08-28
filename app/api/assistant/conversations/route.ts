import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { listerConversations } from '@/lib/queries/assistant-conversations';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/** Historique de l'utilisateur, et de lui seul. Aucun paramètre d'agence côté client. */
export async function GET(req: Request) {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const recherche = new URL(req.url).searchParams.get('q')?.trim().slice(0, 120) ?? '';
  const supabase = await createSupabaseServerClient();
  const conversations = await listerConversations(supabase, profile.id, recherche);

  return NextResponse.json({ conversations });
}
