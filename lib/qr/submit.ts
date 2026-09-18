import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, QrSessionTerrainRow } from '@/types/database';
import { normalizeEmail, normalizePhone } from '@/lib/import/normalize';
import { QR_CONSENT_VERSION, QR_INFO_VERSION, type QrLegalSnapshot } from '@/lib/qr/legal';
import { consumeQrSessionSlot } from '@/lib/qr/session';

type Admin = SupabaseClient<Database>;

export type QrSubmitInput = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  consentGiven: boolean;
  consentText: string;
  latitude: number | null;
  longitude: number | null;
  gpsPrecisionM: number | null;
};

export type QrSubmitError = {
  ok: false;
  error: string;
  field?: 'firstName' | 'lastName' | 'phone' | 'email' | 'consent';
};

export type QrSubmitResult =
  | { ok: true; prenom: string; nom: string; rattache: boolean }
  | QrSubmitError;

function str(v: string, max: number): string {
  return v.trim().slice(0, max);
}

export function validateQrSubmit(
  raw: QrSubmitInput,
): { ok: true; fields: QrSubmitInput } | QrSubmitError {
  const firstName = str(raw.firstName, 80);
  const lastName = str(raw.lastName, 80);
  if (!firstName && !lastName) {
    return { ok: false, error: 'Indiquez votre prénom et votre nom', field: 'lastName' };
  }
  const phoneRaw = str(raw.phone, 40);
  const phoneDigits = phoneRaw ? normalizePhone(phoneRaw) : '';
  if (phoneDigits.length < 10) {
    return { ok: false, error: 'Indiquez un numéro de téléphone', field: 'phone' };
  }
  const email = raw.email ? str(raw.email, 160).toLowerCase() : null;
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { ok: false, error: 'L’adresse email n’est pas valide', field: 'email' };
  }
  if (!raw.consentGiven) {
    return { ok: false, error: 'Cochez la case pour accepter d’être recontacté', field: 'consent' };
  }
  return {
    ok: true,
    fields: {
      firstName,
      lastName,
      phone: phoneRaw,
      email: email ? normalizeEmail(email) : null,
      consentGiven: true,
      consentText: raw.consentText,
      latitude: raw.latitude,
      longitude: raw.longitude,
      gpsPrecisionM: raw.gpsPrecisionM,
    },
  };
}

async function contactIdPourNumero(
  admin: Admin,
  agencyId: string,
  phoneDigits: string,
): Promise<string | null> {
  const { data } = await admin
    .from('contacts')
    .select('id, phone')
    .eq('agency_id', agencyId)
    .limit(4000);
  const hit = (data ?? []).find((row) => row.phone && normalizePhone(row.phone) === phoneDigits);
  return hit?.id ?? null;
}

export async function submitQrConsent(args: {
  admin: Admin;
  session: QrSessionTerrainRow;
  legal: QrLegalSnapshot;
  agentPrenom: string;
  input: QrSubmitInput;
  ip: string | null;
  userAgent: string | null;
  now?: Date;
}): Promise<QrSubmitResult> {
  const parsed = validateQrSubmit(args.input);
  if (!parsed.ok) return parsed;
  if (parsed.fields.consentText.trim() !== args.legal.consentText.trim()) {
    return { ok: false, error: 'Le texte de consentement a changé. Rechargez la page.' };
  }

  const now = args.now ?? new Date();
  const fields = parsed.fields;
  const phoneDigits = normalizePhone(fields.phone);
  const taken = await consumeQrSessionSlot(args.admin, args.session, now, {
    prenom: fields.firstName,
    nom: fields.lastName,
  });
  if (!taken) {
    return { ok: false, error: 'Ce code n’est plus valable.' };
  }

  const contactId = await contactIdPourNumero(args.admin, args.session.agency_id, phoneDigits);

  const lat =
    typeof fields.latitude === 'number' && Number.isFinite(fields.latitude) ? fields.latitude : null;
  const lng =
    typeof fields.longitude === 'number' && Number.isFinite(fields.longitude) ? fields.longitude : null;
  const gps =
    typeof fields.gpsPrecisionM === 'number' && Number.isFinite(fields.gpsPrecisionM)
      ? fields.gpsPrecisionM
      : null;

  const { error: consentError } = await args.admin.from('consentements_telephone').insert({
    agency_id: args.session.agency_id,
    provenance: 'page_qr_terrain',
    contact_id: contactId,
    estimation_request_id: null,
    agent_id: args.session.agent_id,
    agent_prenom: args.agentPrenom,
    latitude: lat,
    longitude: lng,
    gps_precision_m: gps,
    sens: 'accord',
    texte_affiche: args.legal.consentText,
    version: QR_CONSENT_VERSION,
    texte_sha256: args.legal.consentSha256,
    agence_nom_affiche: args.legal.agenceNom,
    horodatage: now.toISOString(),
    ip_address: args.ip,
    user_agent: args.userAgent,
    telephone_normalise: phoneDigits,
    prenom_saisi: fields.firstName || null,
    nom_saisi: fields.lastName || null,
    email_saisi: fields.email,
  });
  if (consentError) {
    console.error('[qr] consentement', consentError);
    return { ok: false, error: 'Impossible d’enregistrer votre accord.' };
  }

  const { error: infoError } = await args.admin.from('informations_legales_delivrances').insert({
    agency_id: args.session.agency_id,
    contact_id: contactId,
    agent_id: args.session.agent_id,
    agent_prenom: args.agentPrenom,
    agence_nom: args.legal.agenceNom,
    support: 'page_qr',
    moyen: null,
    contenu_delivre: args.legal.infoText,
    version: QR_INFO_VERSION,
    delivre_le: now.toISOString(),
  });
  if (infoError) {
    console.error('[qr] information', infoError);
  }

  return {
    ok: true,
    prenom: fields.firstName,
    nom: fields.lastName,
    rattache: Boolean(contactId),
  };
}
