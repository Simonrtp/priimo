/**
 * Structuration d'une dictée en champs de contact — prompt minimal pour limiter les tokens.
 */

import type { ContactInputFields } from '@/lib/contact-input';
import { EMPTY_CONTACT_INPUT, normalizePostalCodes } from '@/lib/contact-input';
import type { ContactType } from '@/types/contact';

const MISTRAL_API_URL = 'https://api.mistral.ai/v1/chat/completions';
const MISTRAL_MODEL = 'mistral-small-latest';
const MAX_TRANSCRIPT_CHARS = 2200;
const MIN_TRANSCRIPT_CHARS = 12;
const MAX_OUTPUT_TOKENS = 220;

const SYSTEM_PROMPT =
  'Extrais des champs contact depuis une note dictée (agent immo FR). JSON strict. Null si non dit. Ne devine jamais.';

function buildPrompt(transcript: string): string {
  return `Note:\n${transcript}\n\nJSON:{firstName,lastName,type:vendeur|acquereur|locataire|autre,phone,email,secteur,address,postalCodes[],budgetMin,budgetMax,surfaceMin,surfaceMax,roomsMin,summary}`;
}

function asInt(v: unknown, max: number): number | null {
  if (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max) return Math.round(v);
  if (typeof v === 'string') {
    const n = Number(v.replace(/[^\d]/g, ''));
    if (Number.isFinite(n) && n > 0 && n <= max) return Math.round(n);
  }
  return null;
}

function asString(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (!s || s.toLowerCase() === 'null') return null;
  return s.slice(0, max);
}

const TYPES: readonly ContactType[] = ['vendeur', 'acquereur', 'locataire', 'autre'];

/** Relie deux prises de dictée sans perdre ce qui a déjà été dit. */
export function joinVoiceTranscripts(previous: string, next: string): string {
  const a = previous.trim();
  const b = next.trim();
  if (!a) return b;
  if (!b) return a;
  return `${a}\n\n${b}`;
}

/**
 * Une dictée de plus complète la fiche : on garde ce qui est déjà là,
 * on n’écrase que si la nouvelle prise dit quelque chose.
 */
export function mergeVoiceFields(
  current: ContactInputFields,
  incoming: ContactInputFields,
): ContactInputFields {
  return {
    firstName: incoming.firstName.trim() || current.firstName,
    lastName: incoming.lastName.trim() || current.lastName,
    type: incoming.type !== 'autre' ? incoming.type : current.type,
    phone: incoming.phone || current.phone,
    email: incoming.email || current.email,
    secteur: incoming.secteur || current.secteur,
    address: incoming.address || current.address,
    postalCodes: incoming.postalCodes.length > 0 ? incoming.postalCodes : current.postalCodes,
    budgetMin: incoming.budgetMin ?? current.budgetMin,
    budgetMax: incoming.budgetMax ?? current.budgetMax,
    surfaceMin: incoming.surfaceMin ?? current.surfaceMin,
    surfaceMax: incoming.surfaceMax ?? current.surfaceMax,
    roomsMin: incoming.roomsMin ?? current.roomsMin,
    summary: incoming.summary || current.summary,
  };
}

export function parseExtraction(raw: string): ContactInputFields {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return { ...EMPTY_CONTACT_INPUT };
  }

  const typeRaw = typeof parsed.type === 'string' ? parsed.type.toLowerCase() : 'autre';
  const type = (TYPES as readonly string[]).includes(typeRaw) ? (typeRaw as ContactType) : 'autre';

  return {
    firstName: asString(parsed.firstName, 80) ?? '',
    lastName: asString(parsed.lastName, 80) ?? '',
    type,
    phone: asString(parsed.phone, 40),
    email: asString(parsed.email, 160),
    secteur: asString(parsed.secteur, 160),
    address: asString(parsed.address, 240),
    postalCodes: normalizePostalCodes(parsed.postalCodes),
    budgetMin: asInt(parsed.budgetMin, 100_000_000),
    budgetMax: asInt(parsed.budgetMax, 100_000_000),
    surfaceMin: asInt(parsed.surfaceMin, 100_000),
    surfaceMax: asInt(parsed.surfaceMax, 100_000),
    roomsMin: asInt(parsed.roomsMin, 50),
    summary: asString(parsed.summary, 4000),
  };
}

export async function extractContactFields(
  transcript: string,
  apiKey: string,
): Promise<ContactInputFields> {
  const trimmed = transcript.trim();
  if (trimmed.length < MIN_TRANSCRIPT_CHARS) {
    return { ...EMPTY_CONTACT_INPUT };
  }

  const capped =
    trimmed.length > MAX_TRANSCRIPT_CHARS ? trimmed.slice(0, MAX_TRANSCRIPT_CHARS) : trimmed;

  const res = await fetch(MISTRAL_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MISTRAL_MODEL,
      temperature: 0,
      max_tokens: MAX_OUTPUT_TOKENS,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildPrompt(capped) },
      ],
    }),
  });

  if (!res.ok) {
    console.error('[voice] structuration HTTP', res.status, await res.text().catch(() => ''));
    return { ...EMPTY_CONTACT_INPUT };
  }

  const body = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = body.choices?.[0]?.message?.content;
  return content ? parseExtraction(content) : { ...EMPTY_CONTACT_INPUT };
}
