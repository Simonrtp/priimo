import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import {
  fileNameForAudioBlob,
  isVoiceBlobTooSmall,
  normalizeAudioMime,
} from '@/lib/voice/audio-blob';
import { clientIpFromRequest, rateLimit } from '@/lib/rate-limit';
import { MistralKeyMissingError, requireMistralKey, transcribeAudio } from '@/lib/voice/transcribe';

export const runtime = 'nodejs';
export const maxDuration = 30;

const MAX_BYTES = 4 * 1024 * 1024;

function erreurTranscription(outcome: Extract<Awaited<ReturnType<typeof transcribeAudio>>, { ok: false }>) {
  if (outcome.kind === 'http') {
    return NextResponse.json(
      { error: 'Le service de transcription est indisponible. Réessayez dans un instant.' },
      { status: 502 },
    );
  }
  if (outcome.kind === 'timeout' || outcome.kind === 'network') {
    return NextResponse.json(
      { error: 'La transcription a pris trop de temps. Réessayez.' },
      { status: 504 },
    );
  }
  return NextResponse.json(
    { error: 'Parlez un peu plus longtemps, puis réessayez.' },
    { status: 422 },
  );
}

/**
 * Transcription pour la recherche et l'assistant. Aucune note n'est créée.
 */
export async function POST(req: Request) {
  const ip = clientIpFromRequest(req);
  const limit = rateLimit(`assistant-voix:${ip}`, { limit: 40, windowMs: 60 * 60 * 1000 });
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Trop de questions vocales. Réessayez dans un instant.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSec) } },
    );
  }

  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
  }

  const audio = form.get('audio');
  if (!(audio instanceof Blob) || audio.size === 0) {
    return NextResponse.json({ error: 'Aucun enregistrement reçu' }, { status: 400 });
  }
  if (audio.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Enregistrement trop long' }, { status: 413 });
  }
  if (isVoiceBlobTooSmall(audio.size)) {
    return NextResponse.json(
      { error: 'Enregistrement trop court. Parlez au moins une seconde.' },
      { status: 422 },
    );
  }

  const mime = normalizeAudioMime(audio.type);
  const allowed = new Set(['audio/webm', 'audio/ogg', 'audio/mpeg', 'audio/mp4', 'audio/wav']);
  if (!allowed.has(mime)) {
    return NextResponse.json({ error: 'Format audio non pris en charge' }, { status: 415 });
  }

  let apiKey: string;
  try {
    apiKey = requireMistralKey();
  } catch (err) {
    if (err instanceof MistralKeyMissingError) {
      return NextResponse.json({ error: 'La dictée vocale est indisponible' }, { status: 503 });
    }
    throw err;
  }

  const fileName = fileNameForAudioBlob(audio, 'question');
  const outcome = await transcribeAudio(audio, fileName, apiKey);
  if (!outcome.ok) {
    return erreurTranscription(outcome);
  }

  return NextResponse.json({ text: outcome.text.slice(0, 500) });
}
