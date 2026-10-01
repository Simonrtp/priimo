'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { notifyError, notifySuccess } from '@/lib/notify';
import { playRecordStartSound, playRecordStopSound } from '@/lib/voice/feedback-sound';
import {
  createVoiceRecorder,
  holdScreenAwake,
  MAX_RECORD_BYTES,
  micErrorMessage,
  newClientId,
  requestMicStream,
  stopMicStream,
} from '@/lib/voice/mic';
import { readDevicePosition } from '@/lib/voice/gps';
import { reverseGeocode } from '@/lib/geo/ban';
import WorkspaceButton from '@/components/dashboard/workspace/WorkspaceButton';
import VoiceWaveform from './VoiceWaveform';
import VoiceReviewPanel from './VoiceReviewPanel';
import EcranDictee from './live/EcranDictee';
import { useComprehensionEnDirect } from './live/useComprehensionEnDirect';
import { useUser } from '@/lib/hooks/useUser';
import type { NameMatchMember } from '@/lib/agency/match-member';
import type { NoteReviewPayload } from '@/lib/notes/build-review';
import { joinVoiceTranscripts } from '@/lib/voice/extract';
import {
  hydrateNoteReview,
  LIVE_FIRST_FLUSH_ESTIMATION_MS,
  LIVE_FIRST_FLUSH_MS,
  LIVE_MIN_BYTES_ESTIMATION,
  prochainDelaiLive,
  transcribeBlob,
  transcribeLive,
} from '@/lib/voice/live';
import { prechaufferTempsReel, TranscriptionTempsReel } from '@/lib/voice/temps-reel';
import { finDeNoteDite, retirerFinDeNote } from '@/lib/voice/fin-de-note';
import { cartesDepuisReview } from '@/lib/voice/cartes';
import type { AssigneeOption } from '@/components/dashboard/workspace/AssigneeSelect';
import type { EstimationVoiceApplyOpts, EstimationVoiceDraft } from '@/lib/estimation/voice-extract';
import { voiceDraftKeys } from '@/lib/estimation/voice-extract';
import { ditSurfaceLogement, extractEstimationHeuristic } from '@/lib/estimation/voice-heuristic';
import { postFormOrQueue } from '@/lib/offline/queue';
import { useTourneeDictation } from '@/components/dashboard/field/TourneeDictationProvider';
import { emitNoteCreated } from '@/lib/notes/note-created-event';
import { demanderAMonAssistant } from '@/lib/assistant/question-event';

type Phase = 'recording' | 'processing' | 'review';

export default function VoiceCaptureDialog({
  onClose,
  streamPromise,
  variant = 'desktop',
  adresse = null,
  parcelleId = null,
  banId = null,
  resterSurPage = false,
  purpose = 'note',
  onEstimationDraft,
}: {
  onClose: () => void;
  streamPromise?: Promise<MediaStream> | null;
  variant?: 'desktop' | 'mobile';
  adresse?: string | null;
  parcelleId?: string | null;
  banId?: string | null;
  resterSurPage?: boolean;
  purpose?: 'note' | 'estimation';
  onEstimationDraft?: (draft: EstimationVoiceDraft, opts?: EstimationVoiceApplyOpts) => void;
}) {
  const estimationMode = purpose === 'estimation';
  const router = useRouter();
  const { profile } = useUser();
  const { noteDictee, adresse: tourAdresse } = useTourneeDictation();

  const [phase, setPhase] = useState<Phase>('recording');
  const [micReady, setMicReady] = useState(false);
  const [micStream, setMicStream] = useState<MediaStream | null>(null);
  const [transcript, setTranscript] = useState('');
  const [voiceNoteId, setVoiceNoteId] = useState<string | null>(null);
  const [review, setReview] = useState<NoteReviewPayload | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [members, setMembers] = useState<NameMatchMember[]>([]);
  const [suggestedAssigneeId, setSuggestedAssigneeId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gpsAddress, setGpsAddress] = useState<string | null>(adresse);
  /** Immeuble sous les pieds de l’agent, pour la lecture en direct seulement. */
  const [banGps, setBanGps] = useState<string | null>(null);
  const [direct, setDirect] = useState(false);
  const [demarreLe, setDemarreLe] = useState(() => Date.now());
  const [recordedAt, setRecordedAt] = useState(() => new Date().toISOString());
  /** Texte des prises précédentes : la prise en cours s'y ajoute. */
  const [basePrise, setBasePrise] = useState('');
  const field = variant === 'mobile';

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number>(0);
  const autoStartedRef = useRef(false);
  const usedInitialStreamRef = useRef(false);
  const cancelledRef = useRef(false);
  const transcriptRef = useRef(transcript);
  const voiceNoteIdRef = useRef(voiceNoteId);
  const gpsRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const liveInFlightRef = useRef(false);
  const liveTextRef = useRef('');
  const takeBaseRef = useRef('');
  const mimeRef = useRef('audio/webm');
  /** Identifiant de la note tiré à l’ouverture : un renvoi ne la duplique pas. */
  const clientNoteIdRef = useRef(newClientId());
  const recordedAtRef = useRef(new Date().toISOString());
  const releaseWakeRef = useRef<() => void>(() => undefined);
  const tempsReelRef = useRef<TranscriptionTempsReel | null>(null);
  const finTempsReelRef = useRef<Promise<string> | null>(null);
  const flushTimerRef = useRef(0);
  const stopRef = useRef<() => void>(() => undefined);
  transcriptRef.current = transcript;
  voiceNoteIdRef.current = voiceNoteId;
  const draftCbRef = useRef(onEstimationDraft);
  draftCbRef.current = onEstimationDraft;
  const extractTimerRef = useRef(0);
  const extractBusyRef = useRef(false);
  const extractAttenteRef = useRef<string | null>(null);
  const extractVuRef = useRef('');

  // Ce que Priimo comprend pendant que l'agent parle.
  const { review: reviewDirect, enCours: lectureDirect } = useComprehensionEnDirect(transcript, {
    actif: !estimationMode && phase !== 'review',
    // L’immeuble où se tient l’agent : « Prospect DPE ici » dès les premiers mots.
    banId: banId ?? banGps,
    recordedAt,
  });
  const cartes = useMemo(() => cartesDepuisReview(reviewDirect), [reviewDirect]);

  /* ------------------------------------------------------ Estimation (inchangé) */

  function pousserDictéeLive(text: string) {
    if (!estimationMode) return;
    const draft = { ...extractEstimationHeuristic(text) };
    if (draft.surfaceM2 != null && !ditSurfaceLogement(text)) draft.surfaceM2 = null;
    if (voiceDraftKeys(draft).length > 0) draftCbRef.current?.(draft, { live: true });
    window.clearTimeout(extractTimerRef.current);
    extractTimerRef.current = window.setTimeout(() => {
      void extraireDictéeModele(text);
    }, 700);
  }

  async function extraireDictéeModele(text: string) {
    const trimmed = text.trim();
    if (!estimationMode || trimmed.length < 8) return;
    if (extractBusyRef.current) {
      extractAttenteRef.current = trimmed;
      return;
    }
    if (trimmed === extractVuRef.current) return;
    extractBusyRef.current = true;
    try {
      const res = await fetch('/api/dashboard/estimation/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: trimmed }),
      });
      const data = (await res.json()) as { draft?: EstimationVoiceDraft };
      if (cancelledRef.current) return;
      if (data.draft && voiceDraftKeys(data.draft).length > 0) {
        extractVuRef.current = trimmed;
        draftCbRef.current?.(data.draft, { live: true });
      }
    } catch {
      /* la passe locale a déjà rempli ce qui était sûr */
    } finally {
      extractBusyRef.current = false;
      const suivant = extractAttenteRef.current;
      extractAttenteRef.current = null;
      if (suivant && suivant !== extractVuRef.current) void extraireDictéeModele(suivant);
    }
  }

  const hasPriorTake = Boolean(voiceNoteId) || basePrise.trim().length > 0;

  const releaseMic = useCallback(() => {
    stopMicStream(recorderRef.current?.stream);
    setMicStream(null);
    setMicReady(false);
  }, []);

  useEffect(() => {
    if (estimationMode) return;
    if (adresse) setGpsAddress(adresse);
    void readDevicePosition().then(async (pos) => {
      gpsRef.current = pos;
      if (!pos || adresse) return;
      const hit = await reverseGeocode(pos.latitude, pos.longitude);
      if (hit) {
        setGpsAddress(hit.adresse_normalisee);
        setBanGps(hit.ban_id);
      }
    });
  }, [adresse, estimationMode]);

  useEffect(() => {
    return () => {
      releaseWakeRef.current();
      window.clearTimeout(flushTimerRef.current);
      tempsReelRef.current?.fermer();
      tempsReelRef.current = null;
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== 'inactive') {
        recorder.ondataavailable = null;
        recorder.onstop = null;
        recorder.stop();
      }
    };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      if (phase === 'review') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, phase]);

  const restoreReview = useCallback(() => {
    releaseMic();
    setPhase('review');
  }, [releaseMic]);

  /** Texte final du direct (au plus 2,5 s d'attente), débarrassé de « fin de note ». */
  async function texteDirectFinal(): Promise<string> {
    const fin = finTempsReelRef.current;
    finTempsReelRef.current = null;
    const texte = fin ? await fin.catch(() => liveTextRef.current) : liveTextRef.current;
    const propre = retirerFinDeNote(texte || liveTextRef.current);
    liveTextRef.current = propre;
    return propre;
  }

  async function uploadEstimation(blob: Blob) {
    const direct = await texteDirectFinal();
    const preview = joinVoiceTranscripts(takeBaseRef.current, direct);
    if (preview.trim()) {
      setTranscript(preview);
      pousserDictéeLive(preview);
    }
    setPhase('processing');
    setError(null);
    releaseMic();

    if (blob.size === 0 && !preview.trim()) {
      setError('Aucun son reçu. Reprenez la dictée.');
      setPhase('recording');
      return;
    }

    try {
      let text = preview;
      if (blob.size > 0) {
        const finalText = await transcribeBlob(blob);
        if (cancelledRef.current) return;
        if (finalText) {
          text = joinVoiceTranscripts(takeBaseRef.current, retirerFinDeNote(finalText));
          setTranscript(text);
          pousserDictéeLive(text);
        }
      }
      const trimmed = text.trim();
      if (trimmed.length < 8) {
        const message = 'Dictée trop courte. Décrivez le bien visité.';
        notifyError(message);
        setError(message);
        setPhase('recording');
        return;
      }

      const res = await fetch('/api/dashboard/estimation/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: trimmed }),
      });
      if (cancelledRef.current) return;
      const data = (await res.json()) as { draft?: EstimationVoiceDraft; error?: string };
      if (!res.ok || !data.draft) {
        const message = data.error ?? 'Lecture impossible';
        notifyError(message);
        setError(message);
        setPhase('recording');
        return;
      }
      onEstimationDraft?.(data.draft);
      onClose();
    } catch {
      if (cancelledRef.current) return;
      const message = 'Lecture impossible';
      notifyError(message);
      setError(message);
      setPhase('recording');
    }
  }

  /* ---------------------------------------------------------------- Envoi */

  async function upload(blob: Blob, durationSeconds: number) {
    if (estimationMode) {
      await uploadEstimation(blob);
      return;
    }
    setPhase('processing');
    setError(null);
    releaseMic();

    const direct = await texteDirectFinal();
    const preview = joinVoiceTranscripts(takeBaseRef.current, direct);
    if (preview.trim()) setTranscript(preview);

    if (blob.size === 0) {
      setError('Aucun son reçu. Reprenez la dictée.');
      setPhase('recording');
      return;
    }

    const previous = takeBaseRef.current.trim();
    const form = new FormData();
    form.append('audio', blob, 'dictee.webm');
    form.append('durationSeconds', String(durationSeconds));
    if (previous) form.append('previousTranscript', previous);
    // Secours : si la transcription finale échoue, le serveur garde ce texte.
    if (direct.trim()) form.append('liveTranscript', direct.trim());
    const continueId = voiceNoteIdRef.current;
    if (continueId) form.append('continueNoteId', continueId);
    else form.append('clientNoteId', clientNoteIdRef.current);
    form.append('priseId', newClientId());
    form.append('recordedAt', recordedAtRef.current);
    const gps = gpsRef.current;
    if (gps) {
      form.append('latitude', String(gps.latitude));
      form.append('longitude', String(gps.longitude));
    }
    const adresseNote = gpsAddress?.trim();
    if (adresseNote) form.append('adresse', adresseNote);
    if (parcelleId) form.append('parcelleId', parcelleId);
    if (banId) form.append('banId', banId);

    const abortToReview = Boolean(continueId) || previous.length > 0;

    try {
      const { queued, res } = await postFormOrQueue('/api/dashboard/voice-notes', form, {
        // Rejouée plus tard, personne ne relira la note à l’écran : le serveur la lit.
        champsSiDifferee: { extraireSurServeur: '1' },
      });
      if (cancelledRef.current) return;

      if (queued) {
        // Enregistrée hors ligne : la note existe pour l'agent, l'envoi suivra.
        emitNoteCreated({ noteId: null, source: 'vocal' });
        if (tourAdresse) noteDictee();
        notifySuccess('Dictée gardée sur le téléphone — envoi et rangement au retour du réseau');
        onClose();
        return;
      }

      if (!res) throw new Error('réseau');
      const data = (await res.json()) as NoteReviewPayload & {
        suggestedAssignee?: { id: string; fullName: string } | null;
        extractionPending?: boolean;
        error?: string;
      };

      if (cancelledRef.current) {
        if (data.voiceNoteId && !continueId) {
          void fetch(`/api/dashboard/voice-notes/${data.voiceNoteId}`, { method: 'DELETE' });
        }
        return;
      }

      if (!res.ok) {
        const message = data.error ?? "La dictée n'a pas pu être traitée";
        notifyError(message);
        setError(message);
        if (abortToReview) {
          restoreReview();
          return;
        }
        setPhase('recording');
        return;
      }

      const nextTranscript = data.transcript ?? previous;
      emitNoteCreated({ noteId: data.voiceNoteId ?? null, source: 'vocal' });
      setVoiceNoteId(data.voiceNoteId);
      setTranscript(nextTranscript);
      // Les cartes vues pendant la dictée restent à l'écran le temps que la
      // lecture approfondie repasse : rien ne disparaît sous les yeux de l'agent.
      setReview(
        reviewDirect
          ? {
              ...reviewDirect,
              voiceNoteId: data.voiceNoteId,
              transcript: nextTranscript,
              visibilite: data.visibilite,
            }
          : data,
      );
      setSuggestedAssigneeId(data.suggestedAssignee?.id ?? null);
      setPhase('review');
      if (tourAdresse) noteDictee();

      if (!data.transcript) {
        notifyError("La dictée n'a pas pu être transcrite. Vous pouvez saisir le texte à la main.");
      }

      if (data.extractionPending && data.voiceNoteId && nextTranscript.trim()) {
        setExtracting(true);
        void hydrateNoteReview(data.voiceNoteId, nextTranscript)
          .then((hydrated) => {
            if (cancelledRef.current) return;
            if (!hydrated) {
              notifyError('La lecture n’a pas abouti. Touchez « Relire le texte corrigé ».');
              return;
            }
            setReview(hydrated);
          })
          .finally(() => {
            if (!cancelledRef.current) setExtracting(false);
          });
      }
    } catch {
      if (cancelledRef.current) return;
      const message = "La dictée n'a pas pu être traitée";
      notifyError(message);
      setError(message);
      if (abortToReview) {
        restoreReview();
        return;
      }
      setPhase('recording');
    }
  }

  const uploadRef = useRef(upload);

  /* ------------------------------------------------------ Transcription vive */

  function recevoirTexteDirect(texte: string) {
    if (finDeNoteDite(texte)) {
      liveTextRef.current = retirerFinDeNote(texte);
      setTranscript(joinVoiceTranscripts(takeBaseRef.current, liveTextRef.current));
      stopRef.current();
      return;
    }
    liveTextRef.current = texte;
    const full = joinVoiceTranscripts(takeBaseRef.current, texte);
    setTranscript(full);
    pousserDictéeLive(full);
  }
  const recevoirRef = useRef(recevoirTexteDirect);

  /** Repli sans Voxtral Realtime : pré-transcription par morceaux, espacée. */
  function basculerSurMorceaux(recorder: MediaRecorder) {
    setDirect(false);
    window.clearTimeout(flushTimerRef.current);
    const flush = () => {
      if (cancelledRef.current || liveInFlightRef.current) return;
      if (recorderRef.current !== recorder || recorder.state !== 'recording') return;
      const blob = new Blob(chunksRef.current, { type: mimeRef.current });
      liveInFlightRef.current = true;
      void transcribeLive(blob, estimationMode ? LIVE_MIN_BYTES_ESTIMATION : undefined)
        .then((text) => {
          if (!text || cancelledRef.current || recorderRef.current !== recorder) return;
          recevoirRef.current(text);
        })
        .finally(() => {
          liveInFlightRef.current = false;
        });
    };
    const planifier = (delai: number) => {
      flushTimerRef.current = window.setTimeout(() => {
        flush();
        if (recorderRef.current !== recorder || recorder.state !== 'recording') return;
        planifier(prochainDelaiLive(Date.now() - startedAtRef.current, estimationMode));
      }, delai);
    };
    planifier(estimationMode ? LIVE_FIRST_FLUSH_ESTIMATION_MS : LIVE_FIRST_FLUSH_MS);
  }

  const startRecording = useCallback(async (reuseInitial = false) => {
    setPhase('recording');
    cancelledRef.current = false;
    setError(null);
    void prechaufferTempsReel();

    try {
      let stream: MediaStream;
      if (reuseInitial && streamPromise && !usedInitialStreamRef.current) {
        usedInitialStreamRef.current = true;
        stream = await streamPromise;
      } else {
        stream = await requestMicStream();
      }

      if (cancelledRef.current) {
        stopMicStream(stream);
        return;
      }

      const recorder = createVoiceRecorder(stream);
      mimeRef.current = recorder.mimeType || 'audio/webm';
      chunksRef.current = [];
      liveTextRef.current = '';
      takeBaseRef.current = transcriptRef.current;
      setBasePrise(transcriptRef.current);
      if (!voiceNoteIdRef.current) {
        recordedAtRef.current = new Date().toISOString();
        setRecordedAt(recordedAtRef.current);
      }
      let bytes = 0;
      releaseWakeRef.current();
      releaseWakeRef.current = holdScreenAwake();

      recorder.ondataavailable = (e) => {
        if (e.data.size === 0) return;
        chunksRef.current.push(e.data);
        bytes += e.data.size;
        // Trop long pour un seul envoi : on garde cette prise, l’agent complète.
        if (bytes >= MAX_RECORD_BYTES && recorder.state === 'recording') {
          stopRef.current();
          notifySuccess('Dictée longue enregistrée. Touchez « Compléter la dictée » pour continuer.');
        }
      };
      recorder.onstop = () => {
        window.clearTimeout(flushTimerRef.current);
        releaseWakeRef.current();
        releaseWakeRef.current = () => undefined;
        const durationSeconds = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
        stopMicStream(stream);
        setMicStream(null);

        if (cancelledRef.current) {
          chunksRef.current = [];
          recorderRef.current = null;
          return;
        }

        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        recorderRef.current = null;
        void uploadRef.current(blob, durationSeconds);
      };

      recorder.start(250);
      recorderRef.current = recorder;
      startedAtRef.current = Date.now();
      setDemarreLe(startedAtRef.current);
      setMicStream(stream);
      setMicReady(true);

      // Le direct s'ouvre en parallèle : l'enregistrement, lui, a déjà commencé.
      void TranscriptionTempsReel.demarrer(stream, {
        onTexte: (t) => recevoirRef.current(t),
        onCoupure: () => {
          tempsReelRef.current = null;
          if (recorderRef.current === recorder && recorder.state === 'recording') basculerSurMorceaux(recorder);
        },
      }).then((session) => {
        if (recorderRef.current !== recorder || recorder.state !== 'recording' || cancelledRef.current) {
          session?.fermer();
          return;
        }
        if (session) {
          tempsReelRef.current = session;
          setDirect(true);
        } else {
          basculerSurMorceaux(recorder);
        }
      });
    } catch (err) {
      notifyError(micErrorMessage(err));
      if (transcriptRef.current.trim()) {
        setPhase('review');
        return;
      }
      onClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estimationMode, onClose, streamPromise]);

  useEffect(() => {
    if (autoStartedRef.current) return;
    autoStartedRef.current = true;
    void startRecording(true);
  }, [startRecording]);

  function stopRecording() {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== 'recording') return;
    const session = tempsReelRef.current;
    tempsReelRef.current = null;
    finTempsReelRef.current = session ? session.arreter() : null;
    recorder.stop();
    playRecordStopSound();
  }
  // Les rappels asynchrones (micro, WebSocket) lisent toujours la dernière version.
  useLayoutEffect(() => {
    stopRef.current = stopRecording;
    uploadRef.current = upload;
    recevoirRef.current = recevoirTexteDirect;
  });

  function couperDirect() {
    tempsReelRef.current?.fermer();
    tempsReelRef.current = null;
    finTempsReelRef.current = null;
    window.clearTimeout(flushTimerRef.current);
  }

  function abandonCapture() {
    cancelledRef.current = true;
    couperDirect();
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    recorderRef.current = null;
    releaseMic();
    onClose();
  }

  function cancelRecording() {
    if (estimationMode || phase === 'processing') {
      abandonCapture();
      return;
    }
    cancelledRef.current = true;
    couperDirect();
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    recorderRef.current = null;
    releaseMic();
    // La prise abandonnée ne laisse rien : on revient au texte d'avant.
    setTranscript(takeBaseRef.current);
    if (takeBaseRef.current.trim() || voiceNoteIdRef.current) {
      setPhase('review');
      return;
    }
    onClose();
  }

  useEffect(() => {
    if (phase !== 'review') return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch('/api/team');
        const data = (await res.json()) as { members?: NameMatchMember[] };
        if (!cancelled) setMembers(data.members ?? []);
      } catch {
        if (!cancelled) setMembers([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [phase]);

  async function continueRecording() {
    playRecordStartSound();
    await startRecording(false);
  }

  function onReviewDone(contactId?: string | null) {
    if (resterSurPage) {
      onClose();
      return;
    }
    router.refresh();
    if (contactId) router.push(`/dashboard/contacts?fiche=${contactId}`);
  }

  /** La dictée était une question : la note s'efface, Mon assistant répond. */
  function passerAMonAssistant(question: string) {
    const id = voiceNoteIdRef.current;
    if (id) void fetch(`/api/dashboard/voice-notes/${id}`, { method: 'DELETE' });
    demanderAMonAssistant(question);
    onClose();
  }

  const memberOptions: AssigneeOption[] = members.map((m) => ({
    id: m.id,
    fullName: m.fullName,
    firstName: m.firstName,
    lastName: m.lastName,
    avatarUrl: m.avatarUrl ?? null,
  }));

  /* ---------------------------------------------------------------- Rendu */

  if (estimationMode && (phase === 'recording' || phase === 'processing')) {
    return (
      <aside
        className="pointer-events-auto fixed inset-x-3 z-[220] mx-auto w-[min(100%,28rem)] rounded-clay-lg bg-surface px-3 py-3 shadow-clay-lg sm:inset-x-auto sm:right-6 sm:mx-0"
        role="dialog"
        aria-modal="false"
        aria-label="Dicter le bien"
        style={{ bottom: field ? 'calc(var(--field-nav-height) + 8px)' : '16px' }}
      >
        {phase === 'processing' ? (
          <div className="py-1" aria-busy="true" aria-label="Lecture de la description…">
            <VoiceWaveform stream={null} compact />
          </div>
        ) : (
          <>
            <VoiceWaveform stream={micStream} compact />
            {error ? (
              <p className="mt-2 text-pretty text-center text-text" style={{ fontSize: 12.5 }}>
                {error}
              </p>
            ) : null}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <WorkspaceButton type="button" variant="secondary" onClick={cancelRecording} className="min-h-11">
                Annuler
              </WorkspaceButton>
              {error && !micReady ? (
                <WorkspaceButton type="button" onClick={() => void startRecording(false)} className="min-h-11">
                  Reprendre
                </WorkspaceButton>
              ) : (
                <WorkspaceButton type="button" onClick={stopRecording} disabled={!micReady} className="min-h-11">
                  Arrêter
                </WorkspaceButton>
              )}
            </div>
          </>
        )}
      </aside>
    );
  }

  if (phase === 'recording' || phase === 'processing') {
    return (
      <EcranDictee
        variant={field ? 'mobile' : 'desktop'}
        phase={phase}
        transcript={transcript}
        cartes={cartes}
        lecture={lectureDirect}
        micStream={micStream}
        micReady={micReady}
        demarreLe={demarreLe}
        direct={direct}
        adresse={gpsAddress}
        error={error}
        hasPriorTake={hasPriorTake}
        onStop={stopRecording}
        onCancel={phase === 'processing' ? abandonCapture : cancelRecording}
        onRetry={() => void startRecording(false)}
      />
    );
  }

  const panneau =
    review ? (
      <VoiceReviewPanel
        review={review}
        transcript={transcript}
        onTranscript={setTranscript}
        onReviewChange={setReview}
        members={memberOptions}
        currentUserId={profile?.id}
        suggestedAssigneeId={suggestedAssigneeId}
        onContinue={() => void continueRecording()}
        onDismiss={onClose}
        onDone={onReviewDone}
        onQuestion={passerAMonAssistant}
        extracting={extracting}
        parcelleId={parcelleId}
        adresse={gpsAddress ?? adresse}
      />
    ) : (
      <p className="px-6 py-8 text-pretty text-text-muted" style={{ fontSize: 14 }}>
        La note est enregistrée.
      </p>
    );

  const entete = (
    <header className="flex flex-shrink-0 items-center gap-3 border-b border-black/[0.06] px-5 py-3.5 sm:px-6">
      <h2 className="min-w-0 flex-1 truncate font-semibold text-text-strong" style={{ fontSize: 15.5 }}>
        Ranger la note
      </h2>
      <button
        type="button"
        onClick={onClose}
        aria-label="Fermer — la note reste dans vos notes à revoir"
        className="flex size-9 flex-shrink-0 items-center justify-center rounded-xl text-text-subtle transition-colors hover:bg-black/[0.04] hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
      >
        <X size={18} strokeWidth={2} aria-hidden />
      </button>
    </header>
  );

  if (field) {
    return (
      <div className="fixed inset-0 z-[220] flex flex-col justify-end bg-[rgba(26,42,86,0.42)]" role="presentation">
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Ranger la note"
          className="flex h-[94dvh] w-full flex-col overflow-hidden rounded-t-clay-xl bg-surface shadow-clay-lg"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          {entete}
          {panneau}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center bg-[rgba(26,42,86,0.45)] p-4" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Ranger la note"
        className="flex max-h-[90vh] w-full max-w-[1080px] flex-col overflow-hidden rounded-clay-lg bg-surface shadow-clay-lg"
      >
        {entete}
        {panneau}
      </div>
    </div>
  );
}
