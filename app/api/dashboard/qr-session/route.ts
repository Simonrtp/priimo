import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { estEnAttente } from '@/lib/billing/acces';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { fetchQrSessionForAgent, openQrSession, toQrSessionPublic } from '@/lib/qr/session';

export const runtime = 'nodejs';

function missing() {
  return NextResponse.json(
    { error: 'Le QR terrain n’est pas encore activé sur cet environnement.' },
    { status: 503 },
  );
}

export async function POST() {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }
  if (estEnAttente(agency)) {
    return NextResponse.json({ error: 'Agence en attente d’activation' }, { status: 403 });
  }

  const opened = await openQrSession(createSupabaseAdminClient(), {
    agencyId: agency.id,
    agentId: profile.id,
  });
  if ('missing' in opened) return missing();
  if ('error' in opened) {
    console.error('[qr] open', opened.error);
    return NextResponse.json({ error: 'Impossible d’ouvrir le QR.' }, { status: 500 });
  }

  return NextResponse.json({
    url: opened.url,
    session: opened.session,
    agentPrenom: profile.first_name.trim() || 'votre conseiller',
    agencyName: agency.name,
  });
}

export async function GET(req: Request) {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Session manquante' }, { status: 400 });

  const row = await fetchQrSessionForAgent(createSupabaseAdminClient(), {
    agencyId: agency.id,
    agentId: profile.id,
    sessionId: id,
  });
  if (row && 'missing' in row) return missing();
  if (!row) return NextResponse.json({ error: 'Session introuvable' }, { status: 404 });
  return NextResponse.json({ session: toQrSessionPublic(row) });
}
