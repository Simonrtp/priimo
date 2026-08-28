import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { clientIpFromRequest, rateLimit } from '@/lib/rate-limit';
import { MistralKeyMissingError, requireMistralKey, transcribeAudio } from '@/lib/voice/transcribe';

export const runtime = 'nodejs';
export const maxDuration = 20;

const MAX_BYTES = 8 * 1024 * 1024;
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
 * Transcription seule, pendant l’enregistrement.
 * Pas de stockage, pas d’extraction : le texte arrive avant l’arrêt.
 */
export async function POST(req: Request) {
  const ip = clientIpFromRequest(req);
  const limit = rateLimit(`voice-stt:${ip}`, { limit: 80, windowMs: 10 * 60 * 1000 });
  if (!limit.ok) {
    return NextResponse.json({ error: 'Trop de transcriptions' }, { status: 429 });
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
    return NextResponse.json({ error: 'Segment trop long' }, { status: 413 });
  }

  const mime = (audio.type || 'audio/webm').split(';')[0];
  if (!ALLOWED_MIME.has(mime)) {
    return NextResponse.json({ error: 'Format audio non pris en charge' }, { status: 415 });
  }

  try {
    const apiKey = requireMistralKey();
    const outcome = await transcribeAudio(audio, `live.${extensionFor(mime)}`, apiKey);
    return NextResponse.json({ text: outcome.ok ? outcome.text : '' });
  } catch (err) {
    if (err instanceof MistralKeyMissingError) {
      return NextResponse.json({ text: '' });
    }
    console.error('[voice] live stt', err);
    return NextResponse.json({ error: 'Transcription indisponible' }, { status: 502 });
  }
}
