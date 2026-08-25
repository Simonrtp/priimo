import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { interpretQuestion } from '@/lib/assistant/interpret';
import { EMPTY_INTENT } from '@/lib/assistant/intent';
import { clientIpFromRequest, rateLimit } from '@/lib/rate-limit';
import { MistralKeyMissingError, requireMistralKey } from '@/lib/voice/transcribe';

export const runtime = 'nodejs';
export const maxDuration = 30;

const MAX_QUESTION = 500;

function questionFromBody(body: unknown): string | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const q = (body as { question?: unknown }).question;
  if (typeof q !== 'string') return null;
  const trimmed = q.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, MAX_QUESTION);
}

export async function POST(req: Request) {
  const ip = clientIpFromRequest(req);
  const limit = rateLimit(`assistant:${ip}`, { limit: 60, windowMs: 60 * 60 * 1000 });
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Trop de recherches coup sur coup. Réessayez dans un instant.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSec) } },
    );
  }

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

  const question = questionFromBody(body);
  if (!question) {
    return NextResponse.json({ error: 'Question manquante' }, { status: 400 });
  }

  let apiKey: string;
  try {
    apiKey = requireMistralKey();
  } catch (err) {
    if (err instanceof MistralKeyMissingError) {
      return NextResponse.json(
        { error: "La recherche n'est pas disponible pour le moment." },
        { status: 503 },
      );
    }
    throw err;
  }

  const intent = await interpretQuestion(question, apiKey);
  return NextResponse.json({ intent: intent ?? EMPTY_INTENT });
}
