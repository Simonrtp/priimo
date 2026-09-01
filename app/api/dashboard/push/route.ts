import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Enregistrement et révocation d'un appareil pour les notifications.
 *
 * L'endpoint fourni par le navigateur est l'identité de l'abonnement : on
 * l'upsert plutôt que de l'insérer, sinon réinstaller l'application créerait un
 * doublon et l'agent recevrait deux fois le même brief.
 */

export const runtime = 'nodejs';

function lireAbonnement(body: unknown): {
  endpoint: string;
  p256dh: string;
  auth: string;
} | null {
  if (typeof body !== 'object' || body === null) return null;
  const raw = body as Record<string, unknown>;
  const endpoint = typeof raw.endpoint === 'string' ? raw.endpoint : null;
  const keys = typeof raw.keys === 'object' && raw.keys !== null ? (raw.keys as Record<string, unknown>) : {};
  const p256dh = typeof keys.p256dh === 'string' ? keys.p256dh : null;
  const auth = typeof keys.auth === 'string' ? keys.auth : null;

  if (!endpoint || !p256dh || !auth) return null;
  if (!/^https:\/\//.test(endpoint)) return null;
  return { endpoint, p256dh, auth };
}

export async function POST(req: Request) {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
  }

  const abonnement = lireAbonnement(body);
  if (!abonnement) {
    return NextResponse.json({ error: 'Abonnement illisible' }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      profile_id: profile.id,
      agency_id: agency.id,
      endpoint: abonnement.endpoint,
      p256dh: abonnement.p256dh,
      auth: abonnement.auth,
      user_agent: req.headers.get('user-agent')?.slice(0, 300) ?? null,
      last_success_at: null,
    },
    { onConflict: 'endpoint' },
  );

  if (error) {
    console.error('[push] enregistrement', error.message);
    return NextResponse.json({ error: 'Enregistrement impossible' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const { user, profile } = await getServerUser();
  if (!user || !profile) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const endpoint = new URL(req.url).searchParams.get('endpoint');
  if (!endpoint) {
    return NextResponse.json({ error: 'Endpoint manquant' }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  // La RLS limite déjà la suppression aux appareils de l'agent connecté.
  const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);

  if (error) {
    console.error('[push] révocation', error.message);
    return NextResponse.json({ error: 'Révocation impossible' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
