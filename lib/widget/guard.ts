/**
 * Garde d'entrée commune aux routes publiques du widget.
 *
 * Toutes les routes /api/embed passent par ici : identifiant public valide,
 * widget actif, origine autorisée, débit borné. Une route qui n'appelle pas
 * cette fonction est une route qui ne protège pas l'agence.
 */

import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { clientIpFromRequest, pruneRateLimitBuckets, rateLimit } from '@/lib/rate-limit';
import { fetchWidgetConfig, isWidgetPublicId, type WidgetConfig } from '@/lib/widget/config';
import { checkRequestOrigin } from '@/lib/widget/origin-guard';
import { hostFromOrigin } from '@/lib/widget/domains';
import { SITE_URL } from '@/lib/site-url';

export type WidgetGuardResult =
  | {
      ok: true;
      config: WidgetConfig;
      admin: ReturnType<typeof createSupabaseAdminClient>;
      ip: string;
      refererUrl: string | null;
    }
  | { ok: false; response: NextResponse };

function fail(status: number, error: string, headers?: HeadersInit): WidgetGuardResult {
  return { ok: false, response: NextResponse.json({ error }, { status, headers }) };
}

/** Hôte de Priimo lui-même : le mode page complète n'est pas un tiers. */
function selfHost(req: Request): string | null {
  return hostFromOrigin(SITE_URL) ?? hostFromOrigin(new URL(req.url).origin);
}

export async function guardWidgetRequest(
  req: Request,
  publicId: unknown,
  limits: { bucket: string; perIp: number; perAgency: number; windowMs: number },
): Promise<WidgetGuardResult> {
  if (!isWidgetPublicId(publicId)) {
    return fail(400, 'Widget inconnu.');
  }

  pruneRateLimitBuckets();
  const ip = clientIpFromRequest(req);

  const byIp = rateLimit(`embed:${limits.bucket}:ip:${ip}`, {
    limit: limits.perIp,
    windowMs: limits.windowMs,
  });
  if (!byIp.ok) {
    return fail(429, 'Trop de demandes. Réessayez dans un instant.', {
      'Retry-After': String(byIp.retryAfterSec),
    });
  }

  const byAgency = rateLimit(`embed:${limits.bucket}:ag:${publicId}`, {
    limit: limits.perAgency,
    windowMs: limits.windowMs,
  });
  if (!byAgency.ok) {
    return fail(429, 'Trop de demandes. Réessayez dans un instant.', {
      'Retry-After': String(byAgency.retryAfterSec),
    });
  }

  const admin = createSupabaseAdminClient();
  const config = await fetchWidgetConfig(admin, publicId);
  if (!config) return fail(404, 'Widget inconnu.');
  if (!config.enabled) return fail(403, 'Ce formulaire est momentanément indisponible.');

  const verdict = checkRequestOrigin(req, config.allowedDomains, selfHost(req));
  if (!verdict.ok) {
    // Le message reste neutre : inutile d'expliquer la liste blanche à qui
    // tente de la contourner.
    return fail(403, 'Ce formulaire est momentanément indisponible.');
  }

  return { ok: true, config, admin, ip, refererUrl: verdict.originUrl };
}
