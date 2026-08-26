import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { clientIpFromRequest, rateLimit } from '@/lib/rate-limit';
import { MistralKeyMissingError, requireMistralKey, transcribeAudio } from '@/lib/voice/transcribe';
import { joinVoiceTranscripts } from '@/lib/voice/extract';
import { fetchMembersOfMyAgency } from '@/lib/queries/agency-members';
import { persistThenExtract } from '@/lib/notes/persist';
import { emptyReviewPayload } from '@/lib/notes/build-review';
import { suggestMemberFromText } from '@/lib/agency/match-member';
import { normalizeParcelleId } from '@/lib/carte/parcelle-id';
import { linkNoteToParcelle } from '@/lib/notes/parcelle-lien';

export const runtime = 'nodejs';
export const maxDuration = 60;

const BUCKET = 'voice-notes';
const MAX_BYTES = 25 * 1024 * 1024;
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

function readCoord(form: FormData, key: string): number | null {
  const raw = form.get(key);
  if (typeof raw !== 'string') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/**
 * Écrit la note dès que l'audio (et si possible la transcription) est là.
 * L'extraction ne peut plus faire perdre la dictée.
 */
export async function POST(req: Request) {
  const ip = clientIpFromRequest(req);
  const limit = rateLimit(`voice-note:${ip}`, { limit: 30, windowMs: 60 * 60 * 1000 });
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Trop de dictées coup sur coup. Réessayez dans un instant.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSec) } },
    );
  }

  const { user, profile, agency, memberships } = await getServerUser();
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

  const durationRaw = form.get('durationSeconds');
  const duration = typeof durationRaw === 'string' ? Number(durationRaw) : NaN;
  const durationSeconds = Number.isFinite(duration) && duration > 0 ? Math.round(duration) : null;
  const gpsLat = readCoord(form, 'latitude');
  const gpsLng = readCoord(form, 'longitude');
  const previousRaw = form.get('previousTranscript');
  const previousTranscript = typeof previousRaw === 'string' ? previousRaw : '';
  const continueIdRaw = form.get('continueNoteId');
  const continueNoteId = typeof continueIdRaw === 'string' && continueIdRaw.trim() ? continueIdRaw.trim() : null;
  const parcelleId = normalizeParcelleId(typeof form.get('parcelleId') === 'string' ? String(form.get('parcelleId')) : null);

  const admin = createSupabaseAdminClient();
  const voiceNoteId = continueNoteId ?? crypto.randomUUID();
  const storagePath = `${agency.id}/${voiceNoteId}.${extensionFor(mime)}`;

  let transcript: string | null = null;
  let apiKey: string | null = null;
  try {
    apiKey = requireMistralKey();
  } catch (err) {
    if (!(err instanceof MistralKeyMissingError)) {
      console.error('[voice] clé', err);
    }
  }

  const transcribePromise = apiKey
    ? transcribeAudio(audio, `dictee.${extensionFor(mime)}`, apiKey).catch((err) => {
        console.error('[voice] transcription', err);
        return null;
      })
    : Promise.resolve(null);

  if (!continueNoteId) {
    const [{ error: uploadError }, transcribed] = await Promise.all([
      admin.storage.from(BUCKET).upload(storagePath, audio, { contentType: mime, upsert: false }),
      transcribePromise,
    ]);
    transcript = transcribed;
    if (uploadError) {
      console.error('[voice] upload', uploadError);
      return NextResponse.json({ error: "L'enregistrement n'a pas pu être conservé" }, { status: 500 });
    }
  } else {
    const [{ data: existing }, transcribed] = await Promise.all([
      admin
        .from('voice_notes')
        .select('id, agency_id, created_by, visibilite, storage_path')
        .eq('id', continueNoteId)
        .eq('agency_id', agency.id)
        .maybeSingle(),
      transcribePromise,
    ]);
    transcript = transcribed;
    if (!existing || existing.created_by !== profile.id) {
      return NextResponse.json({ error: 'Dictée introuvable' }, { status: 404 });
    }
    if (existing.storage_path) {
      await admin.storage
        .from(BUCKET)
        .upload(existing.storage_path, audio, { contentType: mime, upsert: true });
    }
  }

  const joined = joinVoiceTranscripts(previousTranscript, transcript ?? '');
  const gps =
    gpsLat !== null && gpsLng !== null
      ? { latitude: gpsLat, longitude: gpsLng }
      : {};

  let savedId = voiceNoteId;

  try {
    await persistThenExtract(
      async () => {
        if (continueNoteId) {
          const { error } = await admin
            .from('voice_notes')
            .update({
              transcript: joined || null,
              duration_seconds: durationSeconds,
              mime_type: mime,
              status: joined ? 'transcrit' : 'erreur',
              statut: 'brute',
              ...gps,
            })
            .eq('id', continueNoteId)
            .eq('agency_id', agency.id)
            .eq('created_by', profile.id);
          if (error) throw error;
          savedId = continueNoteId;
          return { id: continueNoteId };
        }

        const { error } = await admin.from('voice_notes').insert({
          id: voiceNoteId,
          agency_id: agency.id,
          created_by: profile.id,
          storage_path: storagePath,
          duration_seconds: durationSeconds,
          mime_type: mime,
          transcript: joined || null,
          structured: null,
          status: joined ? 'transcrit' : 'erreur',
          statut: 'brute',
          visibilite: 'agence',
          ...gps,
          ...(typeof form.get('adresse') === 'string' && String(form.get('adresse')).trim()
            ? { adresse_normalisee: String(form.get('adresse')).trim().slice(0, 240) }
            : {}),
        });
        if (error) throw error;
        return { id: voiceNoteId };
      },
      async () => undefined,
    );
  } catch (err) {
    console.error('[voice] enregistrement', err);
    if (!continueNoteId) await admin.storage.from(BUCKET).remove([storagePath]);
    return NextResponse.json({ error: "La dictée n'a pas pu être enregistrée" }, { status: 500 });
  }

  if (parcelleId) {
    await linkNoteToParcelle(admin, { agencyId: agency.id, noteId: savedId, parcelleId });
  }

  let suggestedAssignee: { id: string; fullName: string } | null = null;
  if (joined) {
    try {
      const members = await fetchMembersOfMyAgency(agency.id, memberships);
      const hit = suggestMemberFromText(joined, members, profile.id);
      if (hit) suggestedAssignee = { id: hit.id, fullName: hit.fullName };
    } catch (err) {
      console.error('[voice] suggestion d’assignation', err);
    }
  }

  const review = emptyReviewPayload(savedId, joined || null, 'agence');

  return NextResponse.json({
    ...review,
    suggestedAssignee,
    extractionPending: Boolean(joined),
  });
}
