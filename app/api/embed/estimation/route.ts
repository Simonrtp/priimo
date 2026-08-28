import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { guardWidgetRequest } from '@/lib/widget/guard';
import { declaredPageUrl } from '@/lib/widget/origin-guard';
import { consentTextMatches, widgetConsentSnapshot } from '@/lib/widget/consent';
import { intakeEstimationLead } from '@/lib/widget/intake';
import { runDvfEstimation, type EstimationStep } from '@/lib/estimation/dvf-engine';
import { verifyTurnstileToken } from '@/lib/turnstile';
import type { EstimationPropertyType } from '@/lib/estimation';
import type { EstimationRequestInsert } from '@/types/database';

export const runtime = 'nodejs';

type Parsed = {
  address: string;
  postalCode: string;
  city: string | null;
  banId: string | null;
  latitude: number;
  longitude: number;
  propertyType: EstimationPropertyType;
  surfaceM2: number;
  rooms: number;
  floor: string | null;
  conditionRating: 1 | 2 | 3 | 4 | null;
  dpeClass: string | null;
  saleTimeline: string | null;
};

const TIMELINES = new Set(['3_mois', '6_mois', '1_an', 'renseignement']);

function parseProperty(b: Record<string, unknown>): Parsed | null {
  const address = typeof b.address === 'string' ? b.address.trim().slice(0, 300) : '';
  const postalCode = typeof b.postalCode === 'string' ? b.postalCode.trim() : '';
  const latitude = Number(b.latitude);
  const longitude = Number(b.longitude);
  const surfaceM2 = Number(b.surfaceM2);
  const rooms = Number(b.rooms);
  const propertyType =
    b.propertyType === 'maison' || b.propertyType === 'appartement' ? b.propertyType : null;

  if (!address || !/^\d{5}$/.test(postalCode) || !propertyType) return null;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (!Number.isFinite(surfaceM2) || surfaceM2 <= 0 || surfaceM2 > 5000) return null;
  if (!Number.isFinite(rooms) || rooms <= 0 || rooms > 40) return null;

  const rating = Number(b.conditionRating);
  const conditionRating =
    rating === 1 || rating === 2 || rating === 3 || rating === 4 ? (rating as 1 | 2 | 3 | 4) : null;

  const timeline = typeof b.saleTimeline === 'string' ? b.saleTimeline : '';

  return {
    address,
    postalCode,
    city: typeof b.city === 'string' ? b.city.trim().slice(0, 120) || null : null,
    banId: typeof b.banId === 'string' && b.banId ? b.banId.slice(0, 60) : null,
    latitude,
    longitude,
    propertyType,
    surfaceM2: Math.round(surfaceM2),
    rooms: Math.round(rooms),
    floor: typeof b.floor === 'string' && b.floor && b.floor !== 'inconnu' ? b.floor : null,
    conditionRating,
    dpeClass:
      typeof b.dpeClass === 'string' && b.dpeClass && b.dpeClass !== 'inconnu' ? b.dpeClass : null,
    saleTimeline: TIMELINES.has(timeline) ? timeline : null,
  };
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPhone(phone: string): boolean {
  return phone.replace(/\D/g, '').length >= 10;
}

function summaryFor(p: Parsed): string {
  const bits = [
    `Estimation demandée depuis le site de l'agence`,
    `${p.propertyType === 'maison' ? 'Maison' : 'Appartement'} ${p.surfaceM2} m², ${p.rooms} pièce${p.rooms > 1 ? 's' : ''}`,
    p.address,
  ];
  if (p.saleTimeline) {
    const label: Record<string, string> = {
      '3_mois': 'Projet de vente sous 3 mois',
      '6_mois': 'Projet de vente sous 6 mois',
      '1_an': "Projet de vente d'ici un an",
      renseignement: 'Se renseigne pour le moment',
    };
    bits.push(label[p.saleTimeline] ?? '');
  }
  return bits.filter(Boolean).join(' · ');
}

/**
 * POST — deux modes.
 *
 * `partial` enregistre l'abandon (bien seul, aucune donnée personnelle).
 * `complete` exige le consentement, écrit sa preuve, calcule l'estimation et
 * fait naître le contact vendeur dans l'agence.
 */
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
  }

  const complete = body.mode === 'complete';

  const guard = await guardWidgetRequest(req, body.agency, {
    bucket: complete ? 'submit' : 'draft',
    perIp: complete ? 5 : 40,
    perAgency: complete ? 200 : 900,
    windowMs: 60 * 60 * 1000,
  });
  if (!guard.ok) return guard.response;

  const { admin, config, ip } = guard;

  const property = parseProperty(body);
  if (!property) {
    return NextResponse.json({ error: 'Informations sur le bien incomplètes.' }, { status: 400 });
  }

  const originUrl = declaredPageUrl(body.page, guard.refererUrl);

  /* ------------------------------ brouillon ------------------------------ */
  if (!complete) {
    const draft: EstimationRequestInsert = {
      agency_id: config.agencyId,
      source: 'estimation_site_agence',
      widget_public_id: config.publicId,
      origin_url: originUrl,
      address: property.address,
      latitude: property.latitude,
      longitude: property.longitude,
      postal_code: property.postalCode,
      property_type: property.propertyType,
      surface_m2: property.surfaceM2,
      rooms: property.rooms,
      floor: property.floor,
      condition_rating: property.conditionRating,
      dpe_class: property.dpeClass,
      status: 'abandonne',
      consent_given: false,
    };

    const editToken = typeof body.editToken === 'string' ? body.editToken.trim() : '';
    if (typeof body.id === 'string' && body.id && editToken) {
      const { data } = await admin
        .from('estimation_requests')
        .update(draft)
        .eq('id', body.id)
        .eq('edit_token', editToken)
        .eq('agency_id', config.agencyId)
        .select('id, edit_token')
        .maybeSingle();
      if (data) return NextResponse.json({ id: data.id, editToken: data.edit_token });
    }

    const token = randomBytes(32).toString('hex');
    const { data, error } = await admin
      .from('estimation_requests')
      .insert({ ...draft, edit_token: token })
      .select('id, edit_token')
      .single();
    if (error || !data) {
      console.error('[embed] brouillon', error);
      return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 });
    }
    return NextResponse.json({ id: data.id, editToken: data.edit_token });
  }

  /* ------------------------------- complet ------------------------------- */
  const firstName = typeof body.firstName === 'string' ? body.firstName.trim().slice(0, 80) : '';
  const lastName = typeof body.lastName === 'string' ? body.lastName.trim().slice(0, 80) : '';
  const phone = typeof body.phone === 'string' ? body.phone.trim().slice(0, 40) : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase().slice(0, 160) : '';

  if (firstName.length < 2 || lastName.length < 2) {
    return NextResponse.json({ error: 'Nom et prénom obligatoires.' }, { status: 400 });
  }
  if (!isValidPhone(phone)) {
    return NextResponse.json({ error: 'Numéro de téléphone invalide.' }, { status: 400 });
  }
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: 'Adresse email invalide.' }, { status: 400 });
  }

  // Consentement : la case doit avoir été cochée, et le texte renvoyé doit être
  // exactement celui que nous affichons pour cette agence. Aucun consentement
  // n'est déduit de l'envoi du formulaire.
  const consent = widgetConsentSnapshot(config.displayName);
  if (body.consentGiven !== true) {
    return NextResponse.json(
      { error: 'Votre accord pour être rappelé est nécessaire.' },
      { status: 400 },
    );
  }
  if (!consentTextMatches(body.consentText, consent.text)) {
    return NextResponse.json({ error: 'Formulaire expiré. Rechargez la page.' }, { status: 409 });
  }

  const captcha = await verifyTurnstileToken(
    typeof body.turnstileToken === 'string' ? body.turnstileToken : null,
    ip === 'unknown' ? null : ip,
  );
  if (!captcha.ok) {
    return NextResponse.json({ error: captcha.error }, { status: 400 });
  }

  // Plafond quotidien configuré par l'agence.
  const { data: usedToday } = await admin.rpc('agency_estimations_today', {
    p_agency_id: config.agencyId,
  });
  if (typeof usedToday === 'number' && usedToday >= config.dailyCap) {
    return NextResponse.json(
      { error: 'Le service est momentanément indisponible. Réessayez demain.' },
      { status: 429 },
    );
  }

  // Contexte public : agencyId null, donc aucune donnée interne de l'agence
  // n'entre dans le calcul ni dans le résultat renvoyé au visiteur.
  const noop = (_step: EstimationStep) => undefined;
  const result = await runDvfEstimation(
    admin,
    {
      address: property.address,
      postalCode: property.postalCode,
      city: property.city,
      banId: property.banId,
      latitude: property.latitude,
      longitude: property.longitude,
      propertyType: property.propertyType,
      surfaceM2: property.surfaceM2,
      rooms: property.rooms,
      floor: property.floor,
      conditionRating: property.conditionRating,
      dpeClass: property.dpeClass,
    },
    null,
    noop,
    { sansBienici: true },
  );

  const now = new Date().toISOString();
  const row: EstimationRequestInsert = {
    agency_id: config.agencyId,
    source: 'estimation_site_agence',
    widget_public_id: config.publicId,
    origin_url: originUrl,
    address: property.address,
    latitude: property.latitude,
    longitude: property.longitude,
    postal_code: property.postalCode,
    property_type: property.propertyType,
    surface_m2: property.surfaceM2,
    rooms: property.rooms,
    floor: property.floor,
    condition_rating: property.conditionRating,
    dpe_class: property.dpeClass,
    sale_timeline: property.saleTimeline,
    first_name: firstName,
    last_name: lastName,
    phone,
    email,
    consent_given: true,
    consent_text: consent.text,
    consent_version: consent.version,
    consent_at: now,
    consent_ip: ip === 'unknown' ? null : ip,
    consent_user_agent: req.headers.get('user-agent'),
    estimation_low: result.low,
    estimation_value: result.value,
    estimation_high: result.high,
    estimation_price_per_m2: result.pricePerM2,
    estimation_confidence: result.reliability,
    estimation_context: result.context,
    estimation_sources: result.sources,
    status: 'nouveau',
  };

  const editToken = typeof body.editToken === 'string' ? body.editToken.trim() : '';
  let requestId: string | null = null;

  if (typeof body.id === 'string' && body.id && editToken) {
    const { data } = await admin
      .from('estimation_requests')
      .update(row)
      .eq('id', body.id)
      .eq('edit_token', editToken)
      .eq('agency_id', config.agencyId)
      .select('id')
      .maybeSingle();
    requestId = data?.id ?? null;
  }

  if (!requestId) {
    const { data, error } = await admin
      .from('estimation_requests')
      .insert({ ...row, edit_token: randomBytes(32).toString('hex') })
      .select('id')
      .single();
    if (error || !data) {
      console.error('[embed] enregistrement', error);
      return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 });
    }
    requestId = data.id;
  }

  // La preuve est écrite avant toute autre chose : si la suite échoue, le
  // consentement reste prouvable.
  const { error: consentError } = await admin.from('estimation_consents').insert({
    estimation_request_id: requestId,
    agency_id: config.agencyId,
    consent_text: consent.text,
    consent_version: consent.version,
    consent_text_sha256: consent.sha256,
    agency_name_displayed: config.displayName,
    channel: 'telephone',
    consent_at: now,
    ip_address: ip === 'unknown' ? null : ip,
    user_agent: req.headers.get('user-agent'),
    origin_url: originUrl,
    widget_public_id: config.publicId,
  });
  if (consentError) {
    console.error('[embed] preuve de consentement', consentError);
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 });
  }

  const intake = await intakeEstimationLead(
    admin,
    config.agencyId,
    { firstName, lastName, phone, email },
    {
      address: property.address,
      postalCode: property.postalCode,
      city: property.city,
      banId: property.banId,
      latitude: property.latitude,
      longitude: property.longitude,
      propertyType: property.propertyType,
      surfaceM2: property.surfaceM2,
      rooms: property.rooms,
      saleTimeline: property.saleTimeline,
    },
    summaryFor(property),
  );

  await admin
    .from('estimation_requests')
    .update({ contact_id: intake.contactId, assigned_to: intake.assignedTo })
    .eq('id', requestId);

  // Le visiteur ne reçoit que l'estimation et ses sources publiques.
  return NextResponse.json({
    available: result.available,
    value: result.value,
    low: result.low,
    high: result.high,
    pricePerM2: result.pricePerM2,
    reliability: result.reliability,
    reliabilityLabel: result.reliabilityLabel,
    dispersionElevee: result.context.dispersionElevee,
    comparables: result.context.quartierVentes,
    immeubleVentes: result.context.immeubleVentes,
    radiusM: result.context.radiusM,
    trimestre: result.context.trimestreLabel,
    sources: result.sources,
    steps: result.steps.map((s) => ({ id: s.id, label: s.label })),
  });
}
