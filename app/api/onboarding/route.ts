import { NextResponse } from 'next/server';
import { validateZoneValue, zoneValueToAgencyPayload } from '@/lib/agency-zone';
import { requireDirector } from '@/lib/auth/requireDirector';
import { isValidFrenchPhone, normalizeFrenchPhone } from '@/lib/phone';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { ZoneValue } from '@/types/zone';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseZoneFromBody(body: Record<string, unknown>): ZoneValue | null {
  const zoneType = body.zoneType;
  if (zoneType === 'postal_codes') {
    const raw = body.zonePostalCodes;
    if (!Array.isArray(raw)) return null;
    const codes = raw
      .filter((c): c is string => typeof c === 'string')
      .map((c) => c.trim())
      .filter(Boolean);
    return { type: 'postal_codes', codes };
  }

  if (zoneType === 'radius' || zoneType == null) {
    const address =
      typeof body.zoneCenterAddress === 'string' ? body.zoneCenterAddress.trim() : '';
    const latitude = Number(body.zoneLatitude);
    const longitude = Number(body.zoneLongitude);
    const radius_km = Number(body.zoneRadiusKm);
    return {
      type: 'radius',
      address,
      latitude,
      longitude,
      radius_km,
    };
  }

  return null;
}

export async function POST(request: Request) {
  const guard = await requireDirector();
  if (!guard.ok) return guard.response;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 });
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) {
    return NextResponse.json({ error: "Le nom de l'agence est requis." }, { status: 400 });
  }

  const zone = parseZoneFromBody(body);
  const zoneError = validateZoneValue(zone);
  if (zoneError) {
    return NextResponse.json({ error: zoneError }, { status: 400 });
  }

  const phoneRaw = typeof body.phone === 'string' ? body.phone.trim() : '';
  if (!phoneRaw) {
    return NextResponse.json({ error: 'Le téléphone est requis.' }, { status: 400 });
  }
  if (!isValidFrenchPhone(phoneRaw)) {
    return NextResponse.json(
      { error: 'Format de téléphone invalide (ex. 06 12 34 56 78).' },
      { status: 400 },
    );
  }
  const phone = normalizeFrenchPhone(phoneRaw);

  const emailRaw = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!emailRaw) {
    return NextResponse.json({ error: "L'email est requis." }, { status: 400 });
  }
  if (!EMAIL_REGEX.test(emailRaw)) {
    return NextResponse.json({ error: "Format d'email invalide." }, { status: 400 });
  }
  const email = emailRaw;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('agencies')
    .update({
      name,
      phone,
      email,
      ...zoneValueToAgencyPayload(zone!),
    })
    .eq('id', guard.agency.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
