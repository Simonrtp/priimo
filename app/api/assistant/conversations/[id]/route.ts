import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import {
  chargerConversation,
  lireMessages,
  supprimerConversation,
} from '@/lib/queries/assistant-conversations';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/** Reprise d'un fil. La propriété est revérifiée ici, pas seulement par la RLS. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const { id } = await ctx.params;
  const supabase = await createSupabaseServerClient();
  const etat = await chargerConversation(supabase, id, profile.id);
  if (!etat) {
    return NextResponse.json({ error: 'Conversation introuvable' }, { status: 404 });
  }

  const messages = await lireMessages(supabase, id);
  return NextResponse.json({ conversationId: id, messages });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const { id } = await ctx.params;
  const supabase = await createSupabaseServerClient();
  const ok = await supprimerConversation(supabase, id, profile.id);
  if (!ok) {
    return NextResponse.json({ error: "La conversation n'a pas pu être supprimée." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
