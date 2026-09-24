'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mic, Square, X } from 'lucide-react';
import { notifyError } from '@/lib/notify';
import { playRecordStartSound, playRecordStopSound } from '@/lib/voice/feedback-sound';
import { micErrorMessage, pickAudioMimeType, requestMicStream, stopMicStream } from '@/lib/voice/mic';
import { readDevicePosition } from '@/lib/voice/gps';
import { reverseGeocode } from '@/lib/geo/ban';
import WorkspaceButton from '@/components/dashboard/workspace/WorkspaceButton';
import { ADDRESS_FIELD_INPUT_CLASS } from '@/components/dashboard/workspace/Field';
import AddressAutocomplete from '@/components/AddressAutocomplete';
import VoiceWaveform from './VoiceWaveform';
import VoiceReviewPanel from './VoiceReviewPanel';
import { useUser } from '@/lib/hooks/useUser';
import type { NameMatchMember } from '@/lib/agency/match-member';
import type { NoteReviewPayload } from '@/lib/notes/build-review';
import { emptyReviewPayload } from '@/lib/notes/build-review';
import { joinVoiceTranscripts } from '@/lib/voice/extract';
import {
  hydrateNoteReview,
  LIVE_FIRST_FLUSH_ESTIMATION_MS,
  LIVE_FIRST_FLUSH_MS,
  LIVE_FLUSH_ESTIMATION_MS,
  LIVE_FLUSH_MS,
  LIVE_MIN_BYTES_ESTIMATION,
  transcribeBlob,
  transcribeLive,
} from '@/lib/voice/live';
import type { AssigneeOption } from '@/components/dashboard/workspace/AssigneeSelect';
import type { EstimationVoiceApplyOpts, EstimationVoiceDraft } from '@/lib/estimation/voice-extract';
import { voiceDraftKeys } from '@/lib/estimation/voice-extract';
import { ditSurfaceLogement, extractEstimationHeuristic } from '@/lib/estimation/voice-heuristic';
import { postFormOrQueue } from '@/lib/offline/queue';
import { notifySuccess } from '@/lib/notify';
import { useTourneeDictation } from '@/components/dashboard/field/TourneeDictationProvider';
import { emitNoteCreated } from '@/lib/notes/note-created-event';

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
  const [editingAddress, setEditingAddress] = useState(false);
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
  transcriptRef.current = transcript;
  voiceNoteIdRef.current = voiceNoteId;
  const draftCbRef = useRef(onEstimationDraft);
  draftCbRef.current = onEstimationDraft;
  const extractTimerRef = useRef(0);
  const extractBusyRef = useRef(false);
  const extractAttenteRef = useRef<string | null>(null);
  const extractVuRef = useRef('');

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

  const hasPriorTake = Boolean(voiceNoteId) || transcript.trim().length > 0;

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
      if (hit) setGpsAddress(hit.adresse_normalisee);
    });
  }, [adresse, estimationMode]);

  useEffect(() => {
    return () => {
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

  async function uploadEstimation(blob: Blob) {
    const preview = joinVoiceTranscripts(takeBaseRef.current, liveTextRef.current);
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
          text = joinVoiceTranscripts(takeBaseRef.current, finalText);
          setTranscript(text);
          pousserDictéeLive(text);
        }
      }
      const trimmed = text.trim();
      console.info('[estimation] dictée client transcript', {
        blobBytes: blob.size,
        chars: trimmed.length,
        text: trimmed,
      });
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
      console.info('[estimation] dictée client draft', data.draft);
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

  async function upload(blob: Blob, durationSeconds: number) {
    if (estimationMode) {
      await uploadEstimation(blob);
      return;
    }
    const preview = joinVoiceTranscripts(takeBaseRef.current, liveTextRef.current);
    if (preview.trim()) {
      setTranscript(preview);
      if (voiceNoteIdRef.current) {
        setReview(emptyReviewPayload(voiceNoteIdRef.current, preview));
        setPhase('review');
      } else {
        setPhase('processing');
      }
    } else {
      setPhase('processing');
    }
    setError(null);
    releaseMic();

    if (blob.size === 0) {
      setError('Aucun son reçu. Reprenez la dictée.');
      setPhase('recording');
      return;
    }

    const previous = transcriptRef.current.trim();
    const form = new FormData();
    form.append('audio', blob, 'dictee.webm');
    form.append('durationSeconds', String(durationSeconds));
    if (previous) form.append('previousTranscript', previous);
    const continueId = voiceNoteIdRef.current;
    if (continueId) form.append('continueNoteId', continueId);
    const gps = gpsRef.current;
    if (gps) {
      form.append('latitude', String(gps.latitude));
      form.append('longitude', String(gps.longitude));
    }
    const adresse = gpsAddress?.trim();
    if (adresse) form.append('adresse', adresse);
    if (parcelleId) form.append('parcelleId', parcelleId);
    if (banId) form.append('banId', banId);

    const abortToReview = Boolean(continueId) || previous.length > 0;

    try {
      const { queued, res } = await postFormOrQueue('/api/dashboard/voice-notes', form);
      if (cancelledRef.current) return;

      if (queued) {
        // Enregistrée hors ligne : la note existe pour l'agent, l'envoi suivra.
        emitNoteCreated({ noteId: null, source: 'vocal' });
        if (tourAdresse) noteDictee();
        notifySuccess('Dictée enregistrée — envoi dès le retour du réseau');
        onClose();
        return;
      }

      if (!res) {
        const message = "La dictée n'a pas pu être traitée";
        notifyError(message);
        setError(message);
        if (abortToReview) {
          restoreReview();
          return;
        }
        setPhase('recording');
        return;
      }

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
      setReview(data);
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
              notifyError('La lecture n’a pas abouti. Touchez Mettre à jour.');
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
  uploadRef.current = upload;

  const startRecording = useCallback(async (reuseInitial = false) => {
    setPhase('recording');
    cancelledRef.current = false;
    setError(null);

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

      const mimeType = pickAudioMimeType();
      mimeRef.current = mimeType || 'audio/webm';
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      liveTextRef.current = '';
      takeBaseRef.current = transcriptRef.current;
      let flushTimer = 0;
      let flushSoon = 0;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        window.clearInterval(flushTimer);
        window.clearTimeout(flushSoon);
        const durationSeconds = Math.max(
          1,
          Math.round((Date.now() - startedAtRef.current) / 1000),
        );
        stopMicStream(stream);
        setMicStream(null);

        if (cancelledRef.current) {
          chunksRef.current = [];
          recorderRef.current = null;
          return;
        }

        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || mimeType || 'audio/webm' });
        recorderRef.current = null;
        void uploadRef.current(blob, durationSeconds);
      };

      recorder.start(250);
      recorderRef.current = recorder;
      startedAtRef.current = Date.now();
      setMicStream(stream);
      setMicReady(true);

      const flush = () => {
        if (cancelledRef.current || liveInFlightRef.current) return;
        if (recorderRef.current?.state !== 'recording') return;
        const blob = new Blob(chunksRef.current, { type: mimeRef.current });
        liveInFlightRef.current = true;
        void transcribeLive(blob, estimationMode ? LIVE_MIN_BYTES_ESTIMATION : undefined)
          .then((text) => {
            if (!text || cancelledRef.current) return;
            liveTextRef.current = text;
            const full = joinVoiceTranscripts(takeBaseRef.current, text);
            setTranscript(full);
            pousserDictéeLive(full);
          })
          .finally(() => {
            liveInFlightRef.current = false;
          });
      };
      flushTimer = window.setInterval(flush, estimationMode ? LIVE_FLUSH_ESTIMATION_MS : LIVE_FLUSH_MS);
      flushSoon = window.setTimeout(
        flush,
        estimationMode ? LIVE_FIRST_FLUSH_ESTIMATION_MS : LIVE_FIRST_FLUSH_MS,
      );
    } catch (error) {
      notifyError(micErrorMessage(error));
      if (transcriptRef.current.trim()) {
        setPhase('review');
        return;
      }
      onClose();
    }
  }, [estimationMode, onClose, streamPromise]);

  useEffect(() => {
    if (autoStartedRef.current) return;
    autoStartedRef.current = true;
    void startRecording(true);
  }, [startRecording]);

  function stopRecording() {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== 'recording') return;
    recorder.stop();
    playRecordStopSound();
  }

  function abandonCapture() {
    cancelledRef.current = true;
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop();
    }
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
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop();
    }
    recorderRef.current = null;
    releaseMic();
    if (transcriptRef.current.trim() || voiceNoteId) {
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

  const memberOptions: AssigneeOption[] = members.map((m) => ({
    id: m.id,
    fullName: m.fullName,
    firstName: m.firstName,
    lastName: m.lastName,
    avatarUrl: m.avatarUrl ?? null,
  }));

  const title = estimationMode
    ? 'Dicter le bien'
    : phase === 'review'
      ? 'Vérifiez la note'
      : hasPriorTake
        ? 'Compléter la dictée'
        : 'Dicter une note';

  const processingCopy = estimationMode
    ? 'Lecture de la description…'
    : transcript.trim()
      ? 'Enregistrement de la note…'
      : hasPriorTake
        ? 'Mise en forme de ce que vous avez ajouté…'
        : 'Mise en texte de la dictée…';

  const helpCopy = estimationMode
    ? 'Parlez, les champs se remplissent tout de suite. Si vous vous reprenez, la dernière valeur compte.'
    : hasPriorTake
      ? 'Ajoutez ce qui manque.'
      : 'Parlez normalement.';

  function closeHeader() {
    if (phase === 'recording') {
      cancelRecording();
      return;
    }
    if (phase === 'processing') {
      abandonCapture();
      return;
    }
    onClose();
  }

  const actionsEnregistrement = (
    <div className="grid grid-cols-2 gap-2">
      <WorkspaceButton
        type="button"
        variant="secondary"
        onClick={cancelRecording}
        className="min-h-11"
      >
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
  );

  if (estimationMode && (phase === 'recording' || phase === 'processing')) {
    return (
      <aside
        className="pointer-events-auto fixed inset-x-3 z-[220] mx-auto w-[min(100%,28rem)] rounded-clay-lg bg-surface px-3 py-3 shadow-clay-lg sm:inset-x-auto sm:right-6 sm:mx-0"
        role="dialog"
        aria-modal="false"
        aria-label="Dicter le bien"
        style={{
          bottom: field
            ? 'calc(var(--field-nav-height) + 8px)'
            : '16px',
        }}
      >
        {phase === 'processing' ? (
          <div className="py-1" aria-busy="true" aria-label={processingCopy}>
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
            <div className="mt-3">{actionsEnregistrement}</div>
          </>
        )}
      </aside>
    );
  }

  if (field && (phase === 'recording' || phase === 'processing')) {
    return (
      <div
        className="fixed inset-x-3 z-[220] mx-auto w-[min(100%,20rem)] rounded-clay-lg bg-surface px-3 py-3 shadow-clay-lg"
        role="dialog"
        aria-modal="false"
        aria-label={estimationMode ? 'Dicter le bien' : 'Dicter une note'}
        style={{ bottom: 'calc(12px + env(safe-area-inset-bottom, 0px))' }}
      >
        {phase === 'processing' ? (
          <div className="py-1" aria-busy="true" aria-label={processingCopy}>
            <VoiceWaveform stream={null} compact />
            <p className="mt-2 text-pretty text-center text-text-muted" style={{ fontSize: 13 }}>
              {processingCopy}
            </p>
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
              <WorkspaceButton
                type="button"
                variant="secondary"
                onClick={cancelRecording}
                className="min-h-11"
              >
                Arrêter
              </WorkspaceButton>
              {error && !micReady ? (
                <WorkspaceButton
                  type="button"
                  onClick={() => void startRecording(false)}
                  className="min-h-11"
                >
                  Reprendre
                </WorkspaceButton>
              ) : (
                <WorkspaceButton
                  type="button"
                  onClick={stopRecording}
                  disabled={!micReady}
                  className="min-h-11"
                >
                  Valider
                </WorkspaceButton>
              )}
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[220] flex items-center justify-center bg-[rgba(21,32,47,0.45)] p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className={`flex max-h-[90vh] w-full flex-col overflow-hidden rounded-clay-lg bg-surface shadow-clay-lg ${
          phase === 'review' ? 'max-w-[1040px]' : 'max-w-[420px]'
        }`}
      >
        <header className="flex flex-shrink-0 items-center gap-3 border-b border-black/[0.06] px-5 py-4 sm:px-6">
          <button
            type="button"
            onClick={closeHeader}
            aria-label={
              phase === 'recording' && hasPriorTake
                ? 'Retour à la vérification'
                : 'Annuler la dictée'
            }
            className="flex size-9 flex-shrink-0 items-center justify-center rounded-lg text-text-subtle transition-colors duration-fluid-subtle ease-in-out hover:bg-black/[0.04] hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <X size={18} strokeWidth={2} aria-hidden />
          </button>
          <h2 className="min-w-0 flex-1 text-balance font-semibold text-text-strong" style={{ fontSize: 16 }}>
            {title}
          </h2>
        </header>

        {phase === 'review' && review ? (
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
            extracting={extracting}
            parcelleId={parcelleId}
            adresse={gpsAddress ?? adresse}
          />
        ) : phase === 'review' ? (
          <p className="px-6 py-8 text-pretty text-text-muted" style={{ fontSize: 14 }}>
            La note est enregistrée.
          </p>
        ) : (
          <div className="flex flex-col items-center px-5 py-8 text-center sm:px-6">
            {phase === 'processing' ? (
              <>
                {transcript.trim() ? (
                  <p className="w-full max-w-sm text-pretty text-left text-text" style={{ fontSize: 15 }}>
                    {transcript}
                  </p>
                ) : (
                  <div
                    className="size-10 rounded-full border-2 border-black/10 border-t-blue motion-safe:animate-spin"
                    aria-hidden
                  />
                )}
                <p className="mt-5 text-pretty text-text-muted" style={{ fontSize: 14 }}>
                  {processingCopy}
                </p>
              </>
            ) : (
              <>
                <div
                  className="mb-6 flex size-14 items-center justify-center rounded-full bg-blue/10"
                  aria-hidden
                >
                  <Mic size={22} strokeWidth={2} className="text-blue" />
                </div>

                <VoiceWaveform stream={micStream} />

                <p className="mt-6 text-pretty text-text-muted" style={{ fontSize: 13.5, lineHeight: 1.5 }}>
                  {helpCopy}
                </p>
                {error ? (
                  <p className="mt-3 text-pretty text-text" style={{ fontSize: 13.5, lineHeight: 1.45 }}>
                    {error}
                  </p>
                ) : null}

                <div className="mt-6 flex w-full items-center justify-center gap-2.5">
                  <WorkspaceButton
                    type="button"
                    variant="secondary"
                    onClick={cancelRecording}
                    className="flex-1 sm:flex-none"
                  >
                    {hasPriorTake ? 'Retour' : 'Annuler'}
                  </WorkspaceButton>
                  {error && !micReady ? (
                    <WorkspaceButton
                      type="button"
                      onClick={() => void startRecording(false)}
                      className="flex-1 sm:flex-none"
                    >
                      Reprendre
                    </WorkspaceButton>
                  ) : (
                    <WorkspaceButton
                      type="button"
                      onClick={stopRecording}
                      disabled={!micReady}
                      className="flex-1 sm:flex-none"
                    >
                      <Square size={15} strokeWidth={2} aria-hidden />
                      Arrêter
                    </WorkspaceButton>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
