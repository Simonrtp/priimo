import { randomBytes } from 'node:crypto';
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
import { clientIpFromRequest, pruneRateLimitBuckets, rateLimit } from '@/lib/rate-limit';
import type { EstimationRequestInsert } from '@/types/database';

export const runtime = 'nodejs';

type PartialBody = {
  mode: 'partial';
  id?: string | null;
  editToken?: string | null;
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
  editToken?: string | null;
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

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10;
}

function newEditToken(): string {
  return randomBytes(32).toString('hex');
}

function rateLimitResponse(retryAfterSec: number) {
  return NextResponse.json(
    { error: 'Trop de requêtes. Réessayez dans un instant.' },
    {
      status: 429,
      headers: { 'Retry-After': String(retryAfterSec) },
    },
  );
}

export async function POST(req: Request) {
  pruneRateLimitBuckets();
  const ip = clientIpFromRequest(req);
  const rl = rateLimit(`estimation:${ip}`, { limit: 30, windowMs: 60 * 60 * 1000 });
  if (!rl.ok) return rateLimitResponse(rl.retryAfterSec);

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
  const editToken = typeof body.editToken === 'string' ? body.editToken.trim() : '';

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
      if (!editToken) {
        return NextResponse.json({ error: 'Jeton d’édition manquant.' }, { status: 403 });
      }
      const { data, error } = await admin
        .from('estimation_requests')
        .update(row)
        .eq('id', body.id)
        .eq('edit_token', editToken)
        .select('id, edit_token')
        .maybeSingle();
      if (error) {
        console.error('[estimation] partial update', error);
        return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 });
      }
      if (!data) {
        return NextResponse.json({ error: 'Demande introuvable.' }, { status: 404 });
      }
      return NextResponse.json({ id: data.id, editToken: data.edit_token });
    }

    const token = newEditToken();
    const { data, error } = await admin
      .from('estimation_requests')
      .insert({ ...row, edit_token: token })
      .select('id, edit_token')
      .single();
    if (error) {
      console.error('[estimation] partial insert', error);
      return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 });
    }
    return NextResponse.json({ id: data.id, editToken: data.edit_token });
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
    consent_ip: ip === 'unknown' ? null : ip,
    consent_user_agent: req.headers.get('user-agent'),
    estimation_low: result.low,
    estimation_value: result.value,
    estimation_high: result.high,
    estimation_confidence: result.confidence,
    status: 'nouveau',
  };

  let requestId = body.id ?? null;
  let responseToken = editToken;

  if (requestId) {
    if (!editToken) {
      return NextResponse.json({ error: 'Jeton d’édition manquant.' }, { status: 403 });
    }
    const { data, error } = await admin
      .from('estimation_requests')
      .update(row)
      .eq('id', requestId)
      .eq('edit_token', editToken)
      .select('id, edit_token')
      .maybeSingle();
    if (error) {
      console.error('[estimation] complete update', error);
      return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: 'Demande introuvable.' }, { status: 404 });
    }
    responseToken = data.edit_token;
  } else {
    responseToken = newEditToken();
    const { data, error } = await admin
      .from('estimation_requests')
      .insert({ ...row, edit_token: responseToken })
      .select('id, edit_token')
      .single();
    if (error) {
      console.error('[estimation] complete insert', error);
      return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 });
    }
    requestId = data.id;
    responseToken = data.edit_token;
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
    editToken: responseToken,
    available: result.available,
    low: result.low,
    value: result.value,
    high: result.high,
    pricePerM2: result.pricePerM2,
    confidence: result.confidence,
  });
}
