import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { countComparables, fetchAddressContext } from '@/lib/estimation/dvf-engine';
import { clientIpFromRequest, pruneRateLimitBuckets, rateLimit } from '@/lib/rate-limit';
import type { EstimationPropertyType } from '@/lib/estimation';

export const runtime = 'nodejs';

/**
 * Panneau de contexte du parcours public : ce que la base sait déjà de
 * l'adresse. Données publiques uniquement — aucune donnée d'agence.
 */
export async function POST(req: Request) {
  pruneRateLimitBuckets();
  const ip = clientIpFromRequest(req);
  const rl = rateLimit(`estimation-context:${ip}`, { limit: 120, windowMs: 60 * 60 * 1000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Trop de requêtes.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
  }

  const latitude = Number(body.latitude);
  const longitude = Number(body.longitude);
  const postalCode = typeof body.postalCode === 'string' ? body.postalCode.trim() : '';
  const banId = typeof body.banId === 'string' && body.banId ? body.banId : null;

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !/^\d{5}$/.test(postalCode)) {
    return NextResponse.json({ error: 'Adresse incomplète.' }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const context = await fetchAddressContext(admin, { banId, latitude, longitude, postalCode });

  const propertyType: EstimationPropertyType | null =
    body.propertyType === 'maison' || body.propertyType === 'appartement'
      ? body.propertyType
      : null;

  const comparables = propertyType
    ? await countComparables(admin, { latitude, longitude, postalCode, propertyType })
    : null;

  return NextResponse.json(
    {
      resolved: context.resolved,
      city: typeof body.city === 'string' ? body.city : null,
      postalCode,
      immeubleVentes: context.immeubleVentes,
      derniereVente: context.derniereVente,
      coproLots: context.coproLots,
      coproPeriode: context.coproPeriode,
      dpeKnown: context.dpeKnown,
      dpeRepartition: context.dpeRepartition,
      parcelleKnown: context.parcelleKnown,
      comparables,
    },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
