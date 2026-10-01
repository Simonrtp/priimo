import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { rateLimit } from '@/lib/rate-limit';
import { MistralKeyMissingError, requireMistralKey } from '@/lib/voice/transcribe';
import { MODELE_TEMPS_REEL } from '@/lib/voice/temps-reel-config';

export const runtime = 'nodejs';

/**
 * Jeton court (≈ 15 min, un seul modèle) pour que le navigateur parle
 * directement à Voxtral Realtime. La clé Mistral ne quitte jamais le serveur ;
 * le jeton ne sert qu'à transcrire, et expire seul.
 */
export async function POST() {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const limit = rateLimit(`voice-rt:${profile.id}`, { limit: 60, windowMs: 60 * 60 * 1000 });
  if (!limit.ok) {
    return NextResponse.json({ error: 'Trop de dictées' }, { status: 429 });
  }

  let apiKey: string;
  try {
    apiKey = requireMistralKey();
  } catch (err) {
    if (err instanceof MistralKeyMissingError) {
      return NextResponse.json({ error: 'Transcription en direct indisponible' }, { status: 503 });
    }
    throw err;
  }

  try {
    const res = await fetch('https://api.mistral.ai/v1/client/sessions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ purpose: 'realtime', model: MODELE_TEMPS_REEL }),
      signal: AbortSignal.timeout(6_000),
    });
    if (!res.ok) {
      console.error('[voice] jeton temps réel', res.status);
      return NextResponse.json({ error: 'Transcription en direct indisponible' }, { status: 502 });
    }
    const body = (await res.json()) as {
      client_secret?: { value?: string; expires_at?: string };
      expires_at?: string;
    };
    const token = body.client_secret?.value;
    if (!token) {
      return NextResponse.json({ error: 'Transcription en direct indisponible' }, { status: 502 });
    }
    return NextResponse.json(
      {
        token,
        model: MODELE_TEMPS_REEL,
        expiresAt: body.client_secret?.expires_at ?? body.expires_at ?? null,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    console.error('[voice] jeton temps réel', err instanceof Error ? err.name : 'réseau');
    return NextResponse.json({ error: 'Transcription en direct indisponible' }, { status: 502 });
  }
}
