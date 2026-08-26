import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { ingestPortailEmail } from '@/lib/inbound/ingest';
import { loadAllowedDomains, assertWhitelistedOrDrop } from '@/lib/inbound/whitelist';
import type { IncomingEmail } from '@/lib/inbound/parsers';

export const runtime = 'nodejs';

/**
 * Webhook Pub/Sub Gmail.
 * Ne lit le message QUE si l'expéditeur est dans la liste blanche des domaines portail.
 * Aucun corps hors whitelist n'est stocké.
 *
 * Auth : header X-Priimo-Gmail-Secret === GMAIL_PUBSUB_SHARED_SECRET
 * (en plus de la vérif Pub/Sub côté GCP).
 */
export async function POST(req: Request) {
  const expected = process.env.GMAIL_PUBSUB_SHARED_SECRET?.trim();
  if (!expected || req.headers.get('x-priimo-gmail-secret') !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: {
    agencyId?: string;
    email?: IncomingEmail;
    /** Si true : notification seule — ne pas traiter (history sync ailleurs). */
    pingOnly?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  if (body.pingOnly) {
    return NextResponse.json({ ok: true });
  }

  const agencyId = body.agencyId;
  const email = body.email;
  if (!agencyId || !email?.gmailMessageId || !email.fromAddress) {
    return NextResponse.json({ error: 'agencyId + email requis' }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const allowed = await loadAllowedDomains(admin, agencyId);
  const gate = assertWhitelistedOrDrop(email.fromAddress, allowed);
  if (!gate.allowed) {
    // Ne jamais journaliser le sujet / corps d'un mail hors whitelist.
    return NextResponse.json({ ok: true, dropped: true, reason: 'domain_not_whitelisted' });
  }

  const result = await ingestPortailEmail({ admin, agencyId, email });
  return NextResponse.json({ ok: true, result });
}
