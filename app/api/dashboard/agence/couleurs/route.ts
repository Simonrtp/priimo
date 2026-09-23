import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { normaliserAccent, normaliserAccent2 } from '@/lib/rapport/couleurs';

export const runtime = 'nodejs';

export async function PATCH(req: Request) {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  let body: { principale?: unknown; secondaire?: unknown };
  try {
    body = (await req.json()) as { principale?: unknown; secondaire?: unknown };
  } catch {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
  }

  const couleur_principale = normaliserAccent(typeof body.principale === 'string' ? body.principale : null);
  const couleur_secondaire = normaliserAccent2(typeof body.secondaire === 'string' ? body.secondaire : null);

  const admin = createSupabaseAdminClient();
  let { error } = await admin
    .from('agencies')
    .update({ couleur_principale, couleur_secondaire })
    .eq('id', agency.id);
  if (error && /couleur_secondaire/.test(error.message)) {
    ({ error } = await admin.from('agencies').update({ couleur_principale }).eq('id', agency.id));
  }
  if (error && /couleur_principale/.test(error.message)) {
    return NextResponse.json({ error: 'Couleurs non enregistrées' }, { status: 500 });
  }
  if (error) {
    return NextResponse.json({ error: 'Couleurs non enregistrées' }, { status: 500 });
  }

  return NextResponse.json({ principale: couleur_principale, secondaire: couleur_secondaire });
}
