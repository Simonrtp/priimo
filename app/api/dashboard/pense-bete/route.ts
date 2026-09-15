import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ecrirePenseBete, lirePenseBete, PENSE_BETE_MAX } from '@/lib/activite/pense-bete';
import type { ProfilePreferences } from '@/types/database';

export const runtime = 'nodejs';

/** Enregistre le pense-bête de l’agent connecté. */
export async function PUT(req: Request) {
  const { user, profile } = await getServerUser();
  if (!user || !profile) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
  }

  const texte =
    raw && typeof raw === 'object' && 'texte' in raw && typeof raw.texte === 'string'
      ? raw.texte
      : null;
  if (texte === null) {
    return NextResponse.json({ error: 'Texte invalide' }, { status: 400 });
  }
  if (texte.length > PENSE_BETE_MAX) {
    return NextResponse.json(
      { error: `Le pense-bête ne dépasse pas ${PENSE_BETE_MAX} caractères.` },
      { status: 400 },
    );
  }

  const actuel =
    profile.preferences && typeof profile.preferences === 'object'
      ? (profile.preferences as ProfilePreferences)
      : {};
  const preferences = ecrirePenseBete(actuel, texte);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from('profiles').update({ preferences }).eq('id', profile.id);

  if (error) {
    console.error('[pense-bete]', error);
    return NextResponse.json({ error: 'Enregistrement impossible' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, texte: lirePenseBete(preferences) });
}
