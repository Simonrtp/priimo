import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import {
  CONFIG_ESTIMATION,
  computeEstimation,
  type EstimationFeatureKey,
  type EstimationInput,
  type EstimationPropertyType,
  type EstimationViewType,
} from '@/lib/estimation';
import { sendEstimationNotificationToAdmin } from '@/lib/email/sendEstimationEmail';
import type { EstimationRequestInsert } from '@/types/database';

export const runtime = 'nodejs';

type PartialBody = {
  mode: 'partial';
  id?: string | null;
  address: string;
  latitude: number;
  longitude: number;
  postalCode: string;
  inseeCode: string;
  propertyType: EstimationPropertyType;
  surfaceM2: number;
  rooms: number;
  floor: string | null;
  hasElevator: boolean | null;
  bathrooms: number | null;
};

type CompleteBody = {
  mode: 'complete';
  id?: string | null;
  address: string;
  latitude: number;
  longitude: number;
  postalCode: string;
  inseeCode: string;
  propertyType: EstimationPropertyType;
  surfaceM2: number;
  rooms: number;
  floor: string | null;
  hasElevator: boolean | null;
  bathrooms: number | null;
  features: EstimationFeatureKey[];
  viewType: EstimationViewType;
  constructionYear: number | null;
  dpeClass: string | null;
  conditionRating: number | null;
  isOwner: boolean;
  residenceType: string;
  saleTimeline: string;
  civility: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  consentGiven: boolean;
};

function clientIp(req: Request): string | null {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() || null;
  return req.headers.get('x-real-ip');
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10;
}

export async function POST(req: Request) {
  let body: PartialBody | CompleteBody;
  try {
    body = (await req.json()) as PartialBody | CompleteBody;
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide.' }, { status: 400 });
  }

  if (body.mode !== 'partial' && body.mode !== 'complete') {
    return NextResponse.json({ error: 'Mode invalide.' }, { status: 400 });
  }

  if (!body.address?.trim() || !body.postalCode?.trim() || !body.propertyType) {
    return NextResponse.json({ error: 'Adresse et type de bien requis.' }, { status: 400 });
  }
  if (!(body.surfaceM2 > 0) || !(body.rooms > 0)) {
    return NextResponse.json({ error: 'Surface et pièces obligatoires.' }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();

  if (body.mode === 'partial') {
    const row: EstimationRequestInsert = {
      address: body.address.trim(),
      latitude: body.latitude,
      longitude: body.longitude,
      postal_code: body.postalCode.trim(),
      insee_code: body.inseeCode?.trim() || null,
      property_type: body.propertyType,
      surface_m2: body.surfaceM2,
      rooms: body.rooms,
      floor: body.floor,
      has_elevator: body.hasElevator,
      bathrooms: body.bathrooms,
      status: 'abandonne',
      consent_given: false,
    };

    if (body.id) {
      const { data, error } = await admin
        .from('estimation_requests')
        .update(row)
        .eq('id', body.id)
        .select('id')
        .single();
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ id: data.id });
    }

    const { data, error } = await admin
      .from('estimation_requests')
      .insert(row)
      .select('id')
      .single();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ id: data.id });
  }

  // ——— complete ———
  if (!body.consentGiven) {
    return NextResponse.json({ error: 'Consentement obligatoire.' }, { status: 400 });
  }
  if (!body.firstName?.trim() || !body.lastName?.trim()) {
    return NextResponse.json({ error: 'Prénom et nom obligatoires.' }, { status: 400 });
  }
  if (!isValidEmail(body.email ?? '')) {
    return NextResponse.json({ error: 'Email invalide.' }, { status: 400 });
  }
  if (!isValidPhone(body.phone ?? '')) {
    return NextResponse.json({ error: 'Téléphone invalide.' }, { status: 400 });
  }
  if (typeof body.isOwner !== 'boolean' || !body.residenceType || !body.saleTimeline) {
    return NextResponse.json({ error: 'Projet incomplet.' }, { status: 400 });
  }

  const input: EstimationInput = {
    postalCode: body.postalCode.trim(),
    propertyType: body.propertyType,
    surfaceM2: body.surfaceM2,
    rooms: body.rooms,
    floor: body.floor,
    hasElevator: body.hasElevator,
    bathrooms: body.bathrooms,
    features: body.features ?? [],
    viewType: body.viewType ?? null,
    constructionYear: body.constructionYear,
    dpeClass: body.dpeClass,
    conditionRating: body.conditionRating,
  };

  const result = computeEstimation(input);
  const now = new Date().toISOString();

  const row: EstimationRequestInsert = {
    address: body.address.trim(),
    latitude: body.latitude,
    longitude: body.longitude,
    postal_code: body.postalCode.trim(),
    insee_code: body.inseeCode?.trim() || null,
    property_type: body.propertyType,
    surface_m2: body.surfaceM2,
    rooms: body.rooms,
    floor: body.floor,
    has_elevator: body.hasElevator,
    bathrooms: body.bathrooms,
    features: body.features ?? [],
    view_type: body.viewType,
    construction_year: body.constructionYear,
    dpe_class: body.dpeClass,
    condition_rating: body.conditionRating,
    is_owner: body.isOwner,
    residence_type: body.residenceType,
    sale_timeline: body.saleTimeline,
    civility: body.civility || null,
    first_name: body.firstName.trim(),
    last_name: body.lastName.trim(),
    phone: body.phone.trim(),
    email: body.email.trim().toLowerCase(),
    consent_given: true,
    consent_text: CONFIG_ESTIMATION.CONSENT_TEXT,
    consent_version: CONFIG_ESTIMATION.CONSENT_VERSION,
    consent_at: now,
    consent_ip: clientIp(req),
    consent_user_agent: req.headers.get('user-agent'),
    estimation_low: result.low,
    estimation_value: result.value,
    estimation_high: result.high,
    estimation_confidence: result.confidence,
    status: 'nouveau',
  };

  let requestId = body.id ?? null;

  if (requestId) {
    const { error } = await admin.from('estimation_requests').update(row).eq('id', requestId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } else {
    const { data, error } = await admin
      .from('estimation_requests')
      .insert(row)
      .select('id')
      .single();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    requestId = data.id;
  }

  try {
    await sendEstimationNotificationToAdmin({
      firstName: body.firstName.trim(),
      lastName: body.lastName.trim(),
      civility: body.civility || null,
      phone: body.phone.trim(),
      email: body.email.trim().toLowerCase(),
      address: body.address.trim(),
      postalCode: body.postalCode.trim(),
      propertyType: body.propertyType,
      surfaceM2: body.surfaceM2,
      rooms: body.rooms,
      saleTimeline: body.saleTimeline,
      isOwner: body.isOwner,
      residenceType: body.residenceType,
      estimationAvailable: result.available,
      estimationLow: result.low,
      estimationValue: result.value,
      estimationHigh: result.high,
    });
  } catch (e) {
    console.error('[estimation] email admin failed', e);
  }

  return NextResponse.json({
    id: requestId,
    available: result.available,
    low: result.low,
    value: result.value,
    high: result.high,
    pricePerM2: result.pricePerM2,
    confidence: result.confidence,
  });
}
