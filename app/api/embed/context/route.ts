import { NextResponse } from 'next/server';
import { guardWidgetRequest } from '@/lib/widget/guard';
import { countComparables, fetchAddressContext } from '@/lib/estimation/dvf-engine';
import type { EstimationPropertyType } from '@/lib/estimation';

export const runtime = 'nodejs';

/**
 * Ce que la base sait déjà de l'adresse, pendant que le visiteur répond.
 *
 * Ne renvoie que des données publiques : ventes enregistrées, copropriété,
 * diagnostics. Jamais un lead, un contact ou un indice d'activité de l'agence.
 */
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
  }

  const guard = await guardWidgetRequest(req, body.agency, {
    bucket: 'context',
    perIp: 120,
    perAgency: 900,
    windowMs: 60 * 60 * 1000,
  });
  if (!guard.ok) return guard.response;

  const latitude = Number(body.latitude);
  const longitude = Number(body.longitude);
  const postalCode = typeof body.postalCode === 'string' ? body.postalCode.trim() : '';
  const banId = typeof body.banId === 'string' && body.banId ? body.banId : null;

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !/^\d{5}$/.test(postalCode)) {
    return NextResponse.json({ error: 'Adresse incomplète.' }, { status: 400 });
  }

  const context = await fetchAddressContext(guard.admin, {
    banId,
    latitude,
    longitude,
    postalCode,
  });

  const propertyType: EstimationPropertyType | null =
    body.propertyType === 'maison' || body.propertyType === 'appartement'
      ? body.propertyType
      : null;

  const comparables = propertyType
    ? await countComparables(guard.admin, { latitude, longitude, postalCode, propertyType })
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
