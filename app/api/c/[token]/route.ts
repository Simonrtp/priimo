import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { clientIpFromRequest, pruneRateLimitBuckets, rateLimit } from '@/lib/rate-limit';
import { isPlausibleQrToken } from '@/lib/qr/token';
import { lookupLiveQrSession } from '@/lib/qr/session';
import { QR_CONSENT_VERSION, QR_INFO_VERSION, qrLegalSnapshot } from '@/lib/qr/legal';
import { submitQrConsent, type QrSubmitInput } from '@/lib/qr/submit';

export const runtime = 'nodejs';

function expired() {
  return NextResponse.json({ error: 'Ce lien n’est plus valable.' }, { status: 410 });
}

async function loadContext(token: string) {
  const admin = createSupabaseAdminClient();
  const session = await lookupLiveQrSession(admin, token);
  if (session && 'missing' in session) {
    return { missing: true as const };
  }
  if (!session) return { expired: true as const };

  const [agency, profile, info, consent] = await Promise.all([
    admin.from('agencies').select('name').eq('id', session.agency_id).maybeSingle(),
    admin.from('profiles').select('first_name').eq('id', session.agent_id).maybeSingle(),
    admin
      .from('informations_legales_versions')
      .select('corps')
      .eq('version', QR_INFO_VERSION)
      .maybeSingle(),
    admin
      .from('consentements_telephone_versions')
      .select('corps')
      .eq('version', QR_CONSENT_VERSION)
      .maybeSingle(),
  ]);

  const agencyName = agency.data?.name?.trim() || 'l’agence';
  const agentPrenom = profile.data?.first_name?.trim() || 'votre conseiller';
  const legal = qrLegalSnapshot({
    agenceNom: agencyName,
    agentPrenom,
    infoCorps: info.data?.corps,
    consentCorps: consent.data?.corps,
  });

  return { admin, session, agencyName, agentPrenom, legal };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!isPlausibleQrToken(token)) return expired();
  const ctx = await loadContext(token);
  if ('missing' in ctx) {
    return NextResponse.json({ error: 'Indisponible' }, { status: 503 });
  }
  if ('expired' in ctx) return expired();
  return NextResponse.json({
    agencyName: ctx.agencyName,
    agentPrenom: ctx.agentPrenom,
    infoText: ctx.legal.infoText,
    consentText: ctx.legal.consentText,
  });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  pruneRateLimitBuckets();
  const ip = clientIpFromRequest(req);
  const rl = rateLimit(`qr-submit:${ip}`, { limit: 12, windowMs: 60 * 60 * 1000 });
  if (!rl.ok) {
    return NextResponse.json({ error: 'Trop de tentatives. Réessayez plus tard.' }, { status: 429 });
  }

  const { token } = await params;
  if (!isPlausibleQrToken(token)) return expired();

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
  }

  const ctx = await loadContext(token);
  if ('missing' in ctx) {
    return NextResponse.json({ error: 'Indisponible' }, { status: 503 });
  }
  if ('expired' in ctx) return expired();

  const num = (v: unknown): number | null => {
    if (typeof v !== 'number' || !Number.isFinite(v)) return null;
    return v;
  };

  const input: QrSubmitInput = {
    firstName: typeof body.firstName === 'string' ? body.firstName : '',
    lastName: typeof body.lastName === 'string' ? body.lastName : '',
    phone: typeof body.phone === 'string' ? body.phone : '',
    email: typeof body.email === 'string' ? body.email : null,
    consentGiven: body.consentGiven === true,
    consentText: typeof body.consentText === 'string' ? body.consentText : '',
    latitude: num(body.latitude),
    longitude: num(body.longitude),
    gpsPrecisionM: num(body.gpsPrecisionM),
  };

  const result = await submitQrConsent({
    admin: ctx.admin,
    session: ctx.session,
    legal: ctx.legal,
    agentPrenom: ctx.agentPrenom,
    input,
    ip: ip === 'unknown' ? null : ip,
    userAgent: req.headers.get('user-agent'),
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, field: result.field ?? null },
      { status: 400 },
    );
  }
  return NextResponse.json({ ok: true, agentPrenom: ctx.agentPrenom });
}
