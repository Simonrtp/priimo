import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { sourcesFromContext } from '@/lib/estimation/sources';

export const runtime = 'nodejs';

/**
 * Page publique avis — lecture seule + compteur d'ouvertures.
 * Auth : jeton aléatoire (pas de session).
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;
  if (!token || token.length < 16) {
    return NextResponse.json({ error: 'Lien invalide' }, { status: 404 });
  }

  const admin = createSupabaseAdminClient();
  const { data: row, error } = await admin
    .from('agency_estimations')
    .select(
      `id, address, postal_code, city, property_type, surface_m2, rooms,
       available, price_value, price_low, price_high, price_per_m2, reliability, reliability_label,
       comparables, context, share_expires_at, share_revoked_at, view_count,
       agency_id, created_by, created_at`,
    )
    .eq('share_token', token)
    .maybeSingle();

  if (error || !row) {
    return NextResponse.json({ error: 'Lien introuvable' }, { status: 404 });
  }

  if (row.share_revoked_at) {
    return NextResponse.json({ error: 'Lien révoqué' }, { status: 410 });
  }
  if (row.share_expires_at && Date.parse(row.share_expires_at) < Date.now()) {
    return NextResponse.json({ error: 'Lien expiré' }, { status: 410 });
  }

  await admin
    .from('agency_estimations')
    .update({
      view_count: (row.view_count ?? 0) + 1,
      last_viewed_at: new Date().toISOString(),
    })
    .eq('id', row.id);

  const [{ data: agency }, { data: profile }] = await Promise.all([
    admin.from('agencies').select('name, phone, email').eq('id', row.agency_id).maybeSingle(),
    row.created_by
      ? admin
          .from('profiles')
          .select('first_name, last_name')
          .eq('id', row.created_by)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const comparables = Array.isArray(row.comparables)
    ? (row.comparables as Array<Record<string, unknown>>).map((c) => ({
        date: c.date,
        surfaceM2: c.surfaceM2,
        price: c.price,
        pricePerM2: c.pricePerM2,
        pricePerM2Adjusted: c.pricePerM2Adjusted,
        voie: c.voie,
        sameBuilding: c.sameBuilding,
      }))
    : [];

  return NextResponse.json({
    address: row.address,
    postalCode: row.postal_code,
    city: row.city,
    propertyType: row.property_type,
    surfaceM2: row.surface_m2,
    rooms: row.rooms,
    available: row.available,
    value: row.price_value,
    low: row.price_low,
    high: row.price_high,
    pricePerM2: row.price_per_m2,
    reliability: row.reliability ?? 0,
    reliabilityLabel: row.reliability_label,
    comparables,
    context: row.context,
    sources: sourcesFromContext(row.context),
    createdAt: row.created_at,
    agencyName: agency?.name ?? 'Agence',
    agencyPhone: agency?.phone ?? null,
    agencyEmail: agency?.email ?? null,
    negotiatorName: profile
      ? [profile.first_name, profile.last_name].filter(Boolean).join(' ')
      : null,
  });
}
