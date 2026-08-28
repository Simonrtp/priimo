import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ensureWidgetForAgency } from '@/lib/widget/config';
import { sendWidgetInstallEmail } from '@/lib/email/sendWidgetInstallEmail';
import { widgetSnippet } from '@/lib/widget/snippet';
import { clientIpFromRequest, pruneRateLimitBuckets, rateLimit } from '@/lib/rate-limit';
import { SITE_URL } from '@/lib/site-url';

export const runtime = 'nodejs';

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/**
 * Envoie le code d'intégration au prestataire qui s'occupe du site.
 *
 * Le destinataire est libre — c'est bien le point : l'agence ne sait souvent
 * pas coller deux lignes de HTML, mais elle sait à qui les faire suivre.
 */
export async function POST(req: Request) {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }
  if (profile.role !== 'directeur') {
    return NextResponse.json({ error: 'Réservé au directeur' }, { status: 403 });
  }

  // Un envoi n'est pas anodin : on borne pour éviter d'en faire un relais.
  pruneRateLimitBuckets();
  const rl = rateLimit(`widget-install-email:${agency.id}`, {
    limit: 10,
    windowMs: 60 * 60 * 1000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Trop d’envois. Réessayez dans un moment.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } },
    );
  }
  void clientIpFromRequest(req);

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
  }

  const to = typeof body.to === 'string' ? body.to.trim().toLowerCase().slice(0, 160) : '';
  if (!isValidEmail(to)) {
    return NextResponse.json({ error: 'Adresse email invalide.' }, { status: 400 });
  }

  const message =
    typeof body.message === 'string' && body.message.trim()
      ? body.message.trim().slice(0, 800)
      : null;

  const supabase = await createSupabaseServerClient();
  const config = await ensureWidgetForAgency(supabase, agency.id);
  if (!config) {
    return NextResponse.json({ error: 'Configuration indisponible' }, { status: 500 });
  }

  const senderName =
    [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim() || agency.name;

  try {
    await sendWidgetInstallEmail({
      to,
      agencyName: config.displayName,
      senderName,
      senderEmail: user.email,
      message,
      snippet: widgetSnippet(SITE_URL, config.publicId),
      pageUrl: `${SITE_URL}/e/${config.publicId}`,
      allowedDomains: config.allowedDomains,
    });
  } catch (e) {
    console.error('[widget] envoi du code au prestataire', e);
    return NextResponse.json(
      { error: 'L’email n’a pas pu être envoyé. Réessayez.' },
      { status: 502 },
    );
  }

  const sentAt = new Date().toISOString();
  const { error } = await supabase
    .from('agency_widgets')
    .update({ install_email_to: to, install_email_sent_at: sentAt })
    .eq('agency_id', agency.id);
  if (error) {
    // L'email est parti : on ne fait pas échouer la requête pour la trace.
    console.error('[widget] trace de l’envoi', error);
  }

  return NextResponse.json({ sentTo: to, sentAt });
}
