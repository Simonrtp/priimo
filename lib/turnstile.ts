/**
 * Vérification optionnelle Cloudflare Turnstile.
 * Si TURNSTILE_SECRET_KEY est absent, la vérif est skippée (rate-limit seul).
 */

export async function verifyTurnstileToken(
  token: string | null | undefined,
  ip?: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) {
    return { ok: true };
  }
  if (!token || typeof token !== 'string' || token.length < 10) {
    return { ok: false, error: 'Captcha requis.' };
  }

  const body = new URLSearchParams();
  body.set('secret', secret);
  body.set('response', token);
  if (ip) body.set('remoteip', ip);

  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    });
    const data = (await res.json()) as { success?: boolean };
    if (!data.success) {
      return { ok: false, error: 'Captcha invalide.' };
    }
    return { ok: true };
  } catch {
    console.error('[turnstile] verify failed');
    return { ok: false, error: 'Captcha indisponible.' };
  }
}

export function turnstileSiteKey(): string | null {
  return process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || null;
}
