import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { viewerFromProfile } from '@/lib/agency/visibility';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { rateLimit } from '@/lib/rate-limit';
import { comprendreEnDirect } from '@/lib/notes/extract-review';
import { MistralKeyMissingError } from '@/lib/voice/transcribe';
import { reponseQuotaIa, reserverIa } from '@/lib/ia/quota';

export const runtime = 'nodejs';
export const maxDuration = 20;

const MAX_CHARS = 12_000;

/**
 * Ce que Priimo comprend pendant que l'agent parle : les cartes qui
 * apparaissent sous la transcription. Rien n'est écrit en base.
 */
export async function POST(req: Request) {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const limit = rateLimit(`voice-live:${profile.id}`, { limit: 240, windowMs: 10 * 60 * 1000 });
  if (!limit.ok) {
    return NextResponse.json({ error: 'Trop de lectures' }, { status: 429 });
  }
  if (!(await reserverIa('comprehension'))) return reponseQuotaIa();

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
  }

  const transcript = typeof body.transcript === 'string' ? body.transcript.trim().slice(0, MAX_CHARS) : '';
  if (transcript.length < 12) {
    return NextResponse.json({ error: 'Trop court' }, { status: 422 });
  }
  const banIdRaw = typeof body.banId === 'string' ? body.banId.trim() : '';
  const recordedAt = typeof body.recordedAt === 'string' ? Date.parse(body.recordedAt) : NaN;

  try {
    const review = await comprendreEnDirect({
      admin: createSupabaseAdminClient(),
      agencyId: agency.id,
      transcript,
      banId: banIdRaw && !banIdRaw.startsWith('gps:') ? banIdRaw : null,
      noteDate: Number.isFinite(recordedAt) ? new Date(recordedAt) : undefined,
      agentPrenom: profile.first_name ?? null,
      viewer: viewerFromProfile(profile),
    });
    return NextResponse.json(review, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    if (err instanceof MistralKeyMissingError) {
      return NextResponse.json({ error: 'Lecture indisponible' }, { status: 503 });
    }
    console.error('[voice] lecture en direct', err instanceof Error ? err.message : 'échec');
    return NextResponse.json({ error: 'Lecture indisponible' }, { status: 502 });
  }
}
