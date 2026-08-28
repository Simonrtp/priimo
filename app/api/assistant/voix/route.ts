import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { clientIpFromRequest, rateLimit } from '@/lib/rate-limit';
import { MistralKeyMissingError, requireMistralKey, transcribeAudio } from '@/lib/voice/transcribe';

export const runtime = 'nodejs';
export const maxDuration = 30;

const MAX_BYTES = 4 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  'audio/webm',
  'audio/ogg',
  'audio/mpeg',
  'audio/mp4',
  'audio/wav',
]);

function extensionFor(mime: string): string {
  if (mime.startsWith('audio/ogg')) return 'ogg';
  if (mime.startsWith('audio/mpeg')) return 'mp3';
  if (mime.startsWith('audio/mp4')) return 'm4a';
  if (mime.startsWith('audio/wav')) return 'wav';
  return 'webm';
}

/**
 * Transcription pour la recherche et l'assistant. Aucune note n'est créée.
 */
export async function POST(req: Request) {
  const ip = clientIpFromRequest(req);
  const limit = rateLimit(`assistant-voix:${ip}`, { limit: 40, windowMs: 60 * 60 * 1000 });
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Trop de recherches vocales. Réessayez dans un instant.' },
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

  const mime = (audio.type || 'audio/webm').split(';')[0];
  if (!ALLOWED_MIME.has(mime)) {
    return NextResponse.json({ error: 'Format audio non pris en charge' }, { status: 415 });
  }

  let apiKey: string;
  try {
    apiKey = requireMistralKey();
  } catch (err) {
    if (err instanceof MistralKeyMissingError) {
      return NextResponse.json({ error: 'La recherche vocale est indisponible' }, { status: 503 });
    }
    throw err;
  }

  const text = await transcribeAudio(audio, `recherche.${extensionFor(mime)}`, apiKey);
  if (!text) {
    return NextResponse.json({ error: "La recherche n'a pas pu être comprise" }, { status: 422 });
  }

  return NextResponse.json({ text: text.slice(0, 500) });
}
