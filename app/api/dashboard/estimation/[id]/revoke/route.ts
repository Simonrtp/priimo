import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/** Révoque le lien de partage public. */
export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const { id } = await ctx.params;
  const session = await createSupabaseServerClient();
  const { error } = await session
    .from('agency_estimations')
    .update({ share_revoked_at: new Date().toISOString() })
    .eq('id', id)
    .eq('agency_id', agency.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
