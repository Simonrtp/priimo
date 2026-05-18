import { NextResponse } from 'next/server';
import { requireDirector } from '@/lib/auth/requireDirector';
import { isValidFrenchPhone, normalizeFrenchPhone } from '@/lib/phone';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ZONE_RADIUS_KM_MAX, ZONE_RADIUS_KM_MIN } from '@/lib/zone-config';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  const guard = await requireDirector();
  if (!guard.ok) return guard.response;

  let body: {
    name?: unknown;
    phone?: unknown;
    email?: unknown;
    zoneCenterAddress?: unknown;
    zoneLatitude?: unknown;
    zoneLongitude?: unknown;
    zoneRadiusKm?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 });
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) {
    return NextResponse.json({ error: 'Le nom de l\'agence est requis.' }, { status: 400 });
  }

  const zoneCenterAddress =
    typeof body.zoneCenterAddress === 'string' ? body.zoneCenterAddress.trim() : '';
  if (!zoneCenterAddress || zoneCenterAddress.length < 5) {
    return NextResponse.json(
      { error: 'Sélectionnez une adresse dans la liste de suggestions.' },
      { status: 400 },
    );
  }

  const zoneLatitude = Number(body.zoneLatitude);
  const zoneLongitude = Number(body.zoneLongitude);
  if (
    !Number.isFinite(zoneLatitude) ||
    !Number.isFinite(zoneLongitude) ||
    zoneLatitude < -90 ||
    zoneLatitude > 90 ||
    zoneLongitude < -180 ||
    zoneLongitude > 180
  ) {
    return NextResponse.json(
      { error: 'Adresse invalide : coordonnées GPS manquantes. Choisissez une adresse dans la liste.' },
      { status: 400 },
    );
  }

  const zoneRadiusKm = Number(body.zoneRadiusKm);
  if (!Number.isFinite(zoneRadiusKm) || zoneRadiusKm < ZONE_RADIUS_KM_MIN || zoneRadiusKm > ZONE_RADIUS_KM_MAX) {
    return NextResponse.json(
      { error: `Le rayon doit être compris entre ${ZONE_RADIUS_KM_MIN} et ${ZONE_RADIUS_KM_MAX} km.` },
      { status: 400 },
    );
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
    return NextResponse.json({ error: 'Format d\'email invalide.' }, { status: 400 });
  }
  const email = emailRaw;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('agencies')
    .update({
      name,
      phone,
      email,
      zone_center_address: zoneCenterAddress,
      zone_latitude: zoneLatitude,
      zone_longitude: zoneLongitude,
      zone_radius_km: zoneRadiusKm,
    })
    .eq('id', guard.agency.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
