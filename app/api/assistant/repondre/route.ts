import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { viewerFromProfile } from '@/lib/agency/visibility';
import { collecter } from '@/lib/assistant/collecte';
import { parseIntent, type AssistantIntent } from '@/lib/assistant/intent';
import { journaliserRequete } from '@/lib/assistant/journal';
import { MESSAGE_AIDE, messageAucuneLigne } from '@/lib/assistant/messages';
import { reformulerLignes } from '@/lib/assistant/repondre';
import { fetchMembersOfMyAgency, memberNamesById } from '@/lib/queries/agency-members';
import { clientIpFromRequest, rateLimit } from '@/lib/rate-limit';
import { createSupabaseServerClient } from '@/lib/supabase/server';
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

function intentFromBody(body: unknown): AssistantIntent | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const raw = (body as { intent?: unknown }).intent;
  if (!raw) return null;
  return parseIntent(JSON.stringify(raw));
}

export async function POST(req: Request) {
  const started = Date.now();
  const ip = clientIpFromRequest(req);
  const limit = rateLimit(`assistant-repondre:${ip}`, { limit: 60, windowMs: 60 * 60 * 1000 });
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Trop de recherches coup sur coup. Réessayez dans un instant.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSec) } },
    );
  }

  const { user, profile, agency, memberships } = await getServerUser();
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

  const supabase = await createSupabaseServerClient();
  const intent = intentFromBody(body);
  if (!intent || intent.type === 'inconnu') {
    await journaliserRequete(supabase, {
      agencyId: agency.id,
      profileId: profile.id,
      question,
      type: 'inconnu',
      lignesCount: 0,
      durationMs: Date.now() - started,
    });
    return NextResponse.json({
      reponse: MESSAGE_AIDE,
      sources: [],
      vide: false,
      inconnu: true,
      adresse: null,
      rechercheParTexte: false,
    });
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

  const members = await fetchMembersOfMyAgency(agency.id, memberships);
  const collecte = await collecter(intent, supabase, {
    agencyId: agency.id,
    viewer: viewerFromProfile(profile),
    auteurNoms: memberNamesById(members),
  });

  const vide = collecte.lignes.length === 0;
  const adresse = intent.adresse;

  let reponse: string;
  let brut = false;
  if (vide) {
    reponse = messageAucuneLigne(intent);
  } else {
    const out = await reformulerLignes(question, collecte, apiKey);
    reponse = out.texte;
    brut = out.brut;
  }

  await journaliserRequete(supabase, {
    agencyId: agency.id,
    profileId: profile.id,
    question,
    type: intent.type,
    lignesCount: collecte.lignes.length,
    durationMs: Date.now() - started,
  });

  return NextResponse.json({
    reponse,
    sources: collecte.sources,
    vide,
    inconnu: false,
    adresse,
    rechercheParTexte: collecte.rechercheParTexte,
    brut,
  });
}
