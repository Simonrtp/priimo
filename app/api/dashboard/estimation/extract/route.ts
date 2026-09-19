import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { extractEstimationFields } from '@/lib/estimation/voice-extract';
import { clientIpFromRequest, rateLimit } from '@/lib/rate-limit';
import { MistralKeyMissingError, requireMistralKey } from '@/lib/voice/transcribe';

export const runtime = 'nodejs';
export const maxDuration = 20;

/** Dictée → proposition de champs. Rien n’est écrit en base ici. */
export async function POST(req: Request) {
  const ip = clientIpFromRequest(req);
  const limit = rateLimit(`estimation-extract:${ip}`, { limit: 40, windowMs: 10 * 60 * 1000 });
  if (!limit.ok) {
    return NextResponse.json({ error: 'Trop de lectures' }, { status: 429 });
  }

  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }
  const { refuserSiEstimationFermee } = await import('@/lib/billing/exiger');
  const ferme = refuserSiEstimationFermee(agency);
  if (ferme) return ferme;

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
  if (transcript.trim().length < 12) {
    return NextResponse.json({ error: 'Dictée trop courte' }, { status: 400 });
  }

  try {
    const apiKey = requireMistralKey();
    const draft = await extractEstimationFields(transcript, apiKey);
    return NextResponse.json({ draft });
  } catch (err) {
    if (err instanceof MistralKeyMissingError) {
      return NextResponse.json({ error: 'Transcription indisponible' }, { status: 503 });
    }
    console.error('[estimation] extract', err);
    return NextResponse.json({ error: 'Lecture impossible' }, { status: 500 });
  }
}
