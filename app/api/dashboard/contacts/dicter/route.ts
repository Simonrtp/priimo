import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { extractContactFields, MIN_DICTEE_CONTACT } from '@/lib/contacts/voice-extract';
import { dateParisIso } from '@/lib/notes/date-relative';
import { clientIpFromRequest, rateLimit } from '@/lib/rate-limit';
import { MistralKeyMissingError, requireMistralKey } from '@/lib/voice/transcribe';
import { reponseQuotaIa, reserverIa } from '@/lib/ia/quota';

export const runtime = 'nodejs';
export const maxDuration = 20;

/** Dictée → proposition de champs d'une fiche contact. Rien n'est écrit en base ici. */
export async function POST(req: Request) {
  const ip = clientIpFromRequest(req);
  const limit = rateLimit(`contact-dicter:${ip}`, { limit: 60, windowMs: 10 * 60 * 1000 });
  if (!limit.ok) return NextResponse.json({ error: 'Trop de lectures' }, { status: 429 });

  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
  }
  const transcript =
    typeof body === 'object' && body && 'transcript' in body && typeof body.transcript === 'string'
      ? body.transcript
      : '';
  if (transcript.trim().length < MIN_DICTEE_CONTACT) {
    return NextResponse.json({ error: 'Dictée trop courte' }, { status: 400 });
  }
  if (!(await reserverIa('redaction'))) return reponseQuotaIa();

  try {
    const draft = await extractContactFields(transcript, requireMistralKey(), dateParisIso(new Date()));
    return NextResponse.json({ draft });
  } catch (err) {
    if (err instanceof MistralKeyMissingError) {
      return NextResponse.json({ error: 'Transcription indisponible' }, { status: 503 });
    }
    console.error('[contacts] dicter', err);
    return NextResponse.json({ error: 'Lecture impossible' }, { status: 500 });
  }
}
