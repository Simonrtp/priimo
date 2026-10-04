import { after, NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { rateLimit } from '@/lib/rate-limit';
import {
  DELAI_TRANSCRIPTION_NOTE_MS,
  MistralKeyMissingError,
  requireMistralKey,
  transcribeAudio,
} from '@/lib/voice/transcribe';
import { joinVoiceTranscripts } from '@/lib/voice/extract';
import { fetchMembersOfMyAgency } from '@/lib/queries/agency-members';
import { persistThenExtract } from '@/lib/notes/persist';
import { emptyReviewPayload } from '@/lib/notes/build-review';
import { extractAndBuildReview } from '@/lib/notes/extract-review';
import { suggestMemberFromText } from '@/lib/agency/match-member';
import { normalizeParcelleId } from '@/lib/carte/parcelle-id';
import { linkNoteToParcelle, linkNoteToImmeuble } from '@/lib/notes/parcelle-lien';
import { invaliderAccueilEtProspection, invaliderNotesAccueil } from '@/lib/cache/dashboard';
import { enregistrerRappel } from '@/lib/notes/rappels';
import { notifierNoteTranscrite } from '@/lib/notifications/evenements';
import { cheminPrise, extensionAudio, nettoyerIdPrise, VOICE_BUCKET } from '@/lib/voice/storage';
import { retirerFinDeNote } from '@/lib/voice/fin-de-note';
import { reverseGeocode, type BanGeocodeHit } from '@/lib/geo/ban';
import { vocabulaireAgence } from '@/lib/voice/vocabulaire';
import { reponseQuotaIa, reserverIa } from '@/lib/ia/quota';

export const runtime = 'nodejs';
export const maxDuration = 60;

const BUCKET = VOICE_BUCKET;
const MAX_BYTES = 25 * 1024 * 1024;
const MAX_LIVE_CHARS = 20_000;
const ALLOWED_MIME = new Set([
  'audio/webm',
  'audio/ogg',
  'audio/mpeg',
  'audio/mp4',
  'audio/wav',
]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const extensionFor = extensionAudio;

function readCoord(form: FormData, key: string): number | null {
  const raw = form.get(key);
  if (typeof raw !== 'string') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function readText(form: FormData, key: string): string {
  const raw = form.get(key);
  return typeof raw === 'string' ? raw.trim() : '';
}

/**
 * Heure de la dictée, vue du téléphone. Une note partie de la file hors ligne
 * arrive des heures plus tard : ses « jeudi » et « demain » se comptent depuis
 * le moment où l'agent a parlé.
 */
function readRecordedAt(form: FormData): string | null {
  const t = Date.parse(readText(form, 'recordedAt'));
  if (!Number.isFinite(t)) return null;
  const now = Date.now();
  if (t > now + 5 * 60_000 || t < now - 30 * 86_400_000) return null;
  return new Date(t).toISOString();
}

function estDoublonStockage(error: { message?: string; statusCode?: string } | null): boolean {
  if (!error) return false;
  return error.statusCode === '409' || /exist|duplicate/i.test(error.message ?? '');
}

/**
 * Écrit la note dès que l'audio (et si possible la transcription) est là.
 * L'extraction ne peut plus faire perdre la dictée.
 *
 * Rejouable : le téléphone fournit l'identifiant de la note (et de la prise).
 * Une dictée renvoyée par la file hors ligne après une réponse perdue ne crée
 * pas de doublon.
 */
export async function POST(req: Request) {
  const { user, profile, agency, memberships } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  // Par agent, pas par IP : toute une agence (ou tout un réseau mobile) partage
  // parfois la même adresse.
  const limit = rateLimit(`voice-note:${profile.id}`, { limit: 120, windowMs: 60 * 60 * 1000 });
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Trop de dictées coup sur coup. Réessayez dans un instant.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSec) } },
    );
  }
  if (!(await reserverIa('transcription'))) return reponseQuotaIa();

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
  const previousTranscript = readText(form, 'previousTranscript');
  const liveTranscript = readText(form, 'liveTranscript').slice(0, MAX_LIVE_CHARS);
  const continueIdRaw = readText(form, 'continueNoteId');
  const continueNoteId = continueIdRaw || null;
  const clientNoteId = readText(form, 'clientNoteId');
  const priseId = nettoyerIdPrise(form.get('priseId')) ?? crypto.randomUUID();
  const recordedAt = readRecordedAt(form);
  const extraireSurServeur = readText(form, 'extraireSurServeur') === '1';
  const parcelleId = normalizeParcelleId(typeof form.get('parcelleId') === 'string' ? String(form.get('parcelleId')) : null);
  const banIdRaw = typeof form.get('banId') === 'string' ? String(form.get('banId')).trim() : '';
  const banId = banIdRaw && !banIdRaw.startsWith('gps:') ? banIdRaw : '';

  const admin = createSupabaseAdminClient();
  const voiceNoteId = continueNoteId ?? (UUID.test(clientNoteId) ? clientNoteId : crypto.randomUUID());
  const storagePath = `${agency.id}/${voiceNoteId}.${extensionFor(mime)}`;

  // Rejeu d'une dictée déjà reçue (réponse perdue en 4G, file hors ligne) :
  // on rend la note telle qu'elle est, sans la retranscrire ni la dupliquer.
  if (!continueNoteId) {
    const { data: dejaLa } = await admin
      .from('voice_notes')
      .select('id, created_by, transcript, visibilite')
      .eq('id', voiceNoteId)
      .eq('agency_id', agency.id)
      .maybeSingle();
    if (dejaLa) {
      if (dejaLa.created_by !== profile.id) {
        return NextResponse.json({ error: 'Dictée introuvable' }, { status: 409 });
      }
      return NextResponse.json({
        ...emptyReviewPayload(
          dejaLa.id,
          dejaLa.transcript,
          dejaLa.visibilite === 'privee' ? 'privee' : 'agence',
        ),
        suggestedAssignee: null,
        extractionPending: Boolean(dejaLa.transcript),
      });
    }
  }

  let apiKey: string | null = null;
  try {
    apiKey = requireMistralKey();
  } catch (err) {
    if (!(err instanceof MistralKeyMissingError)) {
      console.error('[voice] clé', err);
    }
  }

  const transcribePromise = apiKey
    ? vocabulaireAgence(admin, agency.id)
        .then((vocabulaire) =>
          transcribeAudio(audio, `dictee.${extensionFor(mime)}`, apiKey!, DELAI_TRANSCRIPTION_NOTE_MS, vocabulaire),
        )
        .then((outcome) => (outcome.ok ? outcome.text : null))
        .catch((err) => {
          console.error('[voice] transcription', err);
          return null;
        })
    : Promise.resolve(null);

  let transcribed: string | null = null;
  let dureeTotale = durationSeconds;
  let visibiliteExistante: 'agence' | 'privee' = 'agence';

  // Dictée sur le terrain sans immeuble choisi : le GPS donne l'immeuble dès
  // l'enregistrement. La note compte tout de suite dans « Informations
  // terrain », sans attendre la lecture complète.
  const immeubleGpsPromise: Promise<BanGeocodeHit | null> =
    !continueNoteId && !banId && gpsLat !== null && gpsLng !== null
      ? reverseGeocode(gpsLat, gpsLng).catch(() => null)
      : Promise.resolve(null);
  let immeubleGps: BanGeocodeHit | null = null;

  if (!continueNoteId) {
    const [{ error: uploadError }, texte, immeuble] = await Promise.all([
      admin.storage.from(BUCKET).upload(storagePath, audio, { contentType: mime, upsert: false }),
      transcribePromise,
      immeubleGpsPromise,
    ]);
    transcribed = texte;
    immeubleGps = immeuble;
    if (uploadError) {
      console.error('[voice] upload', uploadError.message);
      return NextResponse.json({ error: "L'enregistrement n'a pas pu être conservé" }, { status: 500 });
    }
  } else {
    const { data: existing } = await admin
      .from('voice_notes')
      .select('id, agency_id, created_by, visibilite, storage_path, transcript, duration_seconds')
      .eq('id', continueNoteId)
      .eq('agency_id', agency.id)
      .maybeSingle();
    if (!existing || existing.created_by !== profile.id) {
      return NextResponse.json({ error: 'Dictée introuvable' }, { status: 404 });
    }
    visibiliteExistante = existing.visibilite === 'privee' ? 'privee' : 'agence';

    // Chaque prise a son propre fichier : la première n'est plus écrasée.
    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(cheminPrise(agency.id, continueNoteId, priseId, mime), audio, {
        contentType: mime,
        upsert: false,
      });
    if (estDoublonStockage(uploadError)) {
      // Cette prise est déjà arrivée : on ne recolle pas son texte une seconde fois.
      return NextResponse.json({
        ...emptyReviewPayload(continueNoteId, existing.transcript, visibiliteExistante),
        suggestedAssignee: null,
        extractionPending: Boolean(existing.transcript),
      });
    }
    if (uploadError) {
      console.error('[voice] upload prise', uploadError.message);
      return NextResponse.json({ error: "L'enregistrement n'a pas pu être conservé" }, { status: 500 });
    }
    transcribed = await transcribePromise;
    if (durationSeconds !== null) {
      dureeTotale = (existing.duration_seconds ?? 0) + durationSeconds;
    }
  }

  // La transcription finale a échoué : le texte provisoire vaut mieux que rien.
  // « Fin de note » a servi à terminer : il ne reste pas dans le texte.
  const transcript = retirerFinDeNote(transcribed ?? liveTranscript ?? '') || null;
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
              duration_seconds: dureeTotale,
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
          ...(recordedAt ? { created_at: recordedAt } : {}),
          ...gps,
          ...(typeof form.get('adresse') === 'string' && String(form.get('adresse')).trim()
            ? { adresse_normalisee: String(form.get('adresse')).trim().slice(0, 240) }
            : {}),
          ...(banId
            ? { ban_id: banId }
            : immeubleGps
              ? {
                  ban_id: immeubleGps.ban_id,
                  adresse_normalisee: immeubleGps.adresse_normalisee,
                  geocode_score: immeubleGps.score,
                  geocode_le: new Date().toISOString(),
                }
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
  if (banId) {
    await linkNoteToImmeuble(admin, { agencyId: agency.id, noteId: savedId, banId });
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

  const visibilite = continueNoteId ? visibiliteExistante : 'agence';
  const review = emptyReviewPayload(savedId, joined || null, visibilite);

  invaliderNotesAccueil();

  if (joined && !previousTranscript) {
    void notifierNoteTranscrite({
      agencyId: agency.id,
      auteurId: profile.id,
      noteId: savedId,
    }).catch((err) => console.error('[notifications] note_transcrite', err));
  }

  // Personne n'attend la note à l'écran (file hors ligne, dictée en un geste) :
  // la lecture se fait ici, après la réponse, au lieu de dépendre du téléphone.
  const lectureServeur = extraireSurServeur && Boolean(joined);
  if (lectureServeur) {
    const noteDate = recordedAt ? new Date(recordedAt) : new Date();
    after(async () => {
      try {
        const lue = await extractAndBuildReview({
          admin,
          agencyId: agency.id,
          voiceNoteId: savedId,
          transcript: joined,
          visibilite,
          keepGps: gpsLat !== null && gpsLng !== null,
          noteDate,
          agentPrenom: profile.first_name ?? null,
          lieuConnu: {
            banId: banId || null,
            adresse: readText(form, 'adresse') || null,
            latitude: gpsLat,
            longitude: gpsLng,
          },
        });
        // Personne ne relira cette note tout de suite : les rappels et tâches
        // datés vont d'office sur l'accueil de l'agent. Ils ne concernent que
        // lui et s'effacent d'un geste. Contacts et mises à jour attendent sa
        // validation.
        let rappels = 0;
        for (const a of lue.actions) {
          if ((a.type !== 'rappel' && a.type !== 'tache') || a.dateDeduite) continue;
          const personne = lue.personnes.find((p) => p.id === a.personneRef);
          const certain = personne?.matches.find((m) => m.confiance === 'certain');
          try {
            if (
              await enregistrerRappel(admin, agency.id, savedId, {
                intitule: a.intitule,
                date: a.date,
                heure: a.heure,
                contactId: certain?.contactId ?? null,
                profileId: profile.id,
              })
            ) {
              rappels += 1;
            }
          } catch (err) {
            console.error('[voice] rappel automatique', err instanceof Error ? err.message : err);
          }
        }
        invaliderNotesAccueil();
        if (rappels > 0) invaliderAccueilEtProspection();
      } catch (err) {
        console.error('[voice] lecture différée', err);
      }
    });
  }

  return NextResponse.json({
    ...review,
    suggestedAssignee,
    extractionPending: Boolean(joined) && !lectureServeur,
  });
}
