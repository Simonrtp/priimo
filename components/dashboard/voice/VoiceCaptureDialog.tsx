'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mic, Square, X } from 'lucide-react';
import { notifyError } from '@/lib/notify';
import { shouldLockVoice } from '@/lib/voice/gesture-lock';
import { playRecordStartSound, playRecordStopSound } from '@/lib/voice/feedback-sound';
import { micErrorMessage, pickAudioMimeType, requestMicStream, stopMicStream } from '@/lib/voice/mic';
import { readDevicePosition } from '@/lib/voice/gps';
import { reverseGeocode } from '@/lib/geo/ban';
import WorkspaceButton from '@/components/dashboard/workspace/WorkspaceButton';
import { ADDRESS_FIELD_INPUT_CLASS } from '@/components/dashboard/workspace/Field';
import AddressAutocomplete from '@/components/AddressAutocomplete';
import VoiceWaveform from './VoiceWaveform';
import VoiceReviewPanel from './VoiceReviewPanel';
import VoiceLockHint from './VoiceLockHint';
import { useUser } from '@/lib/hooks/useUser';
import type { NameMatchMember } from '@/lib/agency/match-member';
import type { NoteReviewPayload } from '@/lib/notes/build-review';
import { emptyReviewPayload } from '@/lib/notes/build-review';
import { joinVoiceTranscripts } from '@/lib/voice/extract';
import { hydrateNoteReview, LIVE_FLUSH_MS, transcribeLive } from '@/lib/voice/live';
import type { AssigneeOption } from '@/components/dashboard/workspace/AssigneeSelect';

type Phase = 'recording' | 'processing' | 'review';

export default function VoiceCaptureDialog({
  onClose,
  streamPromise,
  variant = 'desktop',
  adresse = null,
  parcelleIdu = null,
}: {
  onClose: () => void;
  streamPromise?: Promise<MediaStream> | null;
  variant?: 'desktop' | 'mobile';
  adresse?: string | null;
  parcelleIdu?: string | null;
}) {
  const router = useRouter();
  const { profile } = useUser();

  const [phase, setPhase] = useState<Phase>('recording');
  const [micReady, setMicReady] = useState(false);
  const [micStream, setMicStream] = useState<MediaStream | null>(null);
  const [transcript, setTranscript] = useState('');
  const [voiceNoteId, setVoiceNoteId] = useState<string | null>(null);
  const [review, setReview] = useState<NoteReviewPayload | null>(null);
  const [members, setMembers] = useState<NameMatchMember[]>([]);
  const [suggestedAssigneeId, setSuggestedAssigneeId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gpsAddress, setGpsAddress] = useState<string | null>(adresse);
  const [editingAddress, setEditingAddress] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [recordingLocked, setRecordingLocked] = useState(false);
  const [lockSwipeY, setLockSwipeY] = useState(0);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
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

  const hasPriorTake = Boolean(voiceNoteId) || transcript.trim().length > 0;

  useEffect(() => {
    if (phase !== 'recording' || !micReady) {
      setElapsed(0);
      return;
    }
    setElapsed(0);
    const t = window.setInterval(() => {
      setElapsed(Math.max(0, Math.round((Date.now() - startedAtRef.current) / 1000)));
    }, 250);
    return () => window.clearInterval(t);
  }, [phase, micReady]);

  const releaseMic = useCallback(() => {
    stopMicStream(recorderRef.current?.stream);
    setMicStream(null);
    setMicReady(false);
  }, []);

  useEffect(() => {
    if (adresse) setGpsAddress(adresse);
    void readDevicePosition().then(async (pos) => {
      gpsRef.current = pos;
      if (!pos || adresse) return;
      const hit = await reverseGeocode(pos.latitude, pos.longitude);
      if (hit) setGpsAddress(hit.adresse_normalisee);
    });
  }, [adresse]);

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
      if (e.key === 'Escape' && phase === 'review') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, phase]);

  const restoreReview = useCallback(() => {
    releaseMic();
    setPhase('review');
  }, [releaseMic]);

  async function upload(blob: Blob, durationSeconds: number) {
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
    if (parcelleIdu) form.append('parcelleIdu', parcelleIdu);

    const abortToReview = Boolean(continueId) || previous.length > 0;

    try {
      const res = await fetch('/api/dashboard/voice-notes', { method: 'POST', body: form });
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
      setVoiceNoteId(data.voiceNoteId);
      setTranscript(nextTranscript);
      setReview(data);
      setSuggestedAssigneeId(data.suggestedAssignee?.id ?? null);
      setPhase('review');

      if (!data.transcript) {
        notifyError("La dictée n'a pas pu être transcrite. Vous pouvez saisir le texte à la main.");
      }

      if (data.extractionPending && data.voiceNoteId && nextTranscript.trim()) {
        void hydrateNoteReview(data.voiceNoteId, nextTranscript).then((hydrated) => {
          if (cancelledRef.current || !hydrated) return;
          setReview(hydrated);
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
    setRecordingLocked(false);
    setLockSwipeY(0);
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
        void transcribeLive(blob)
          .then((text) => {
            if (text && !cancelledRef.current) liveTextRef.current = text;
          })
          .finally(() => {
            liveInFlightRef.current = false;
          });
      };
      flushTimer = window.setInterval(flush, LIVE_FLUSH_MS);
      flushSoon = window.setTimeout(flush, 1800);
    } catch (error) {
      notifyError(micErrorMessage(error));
      if (transcriptRef.current.trim()) {
        setPhase('review');
        return;
      }
      onClose();
    }
  }, [onClose, streamPromise]);

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
    if (phase === 'processing') {
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
    router.refresh();
    if (contactId) router.push(`/dashboard/contacts?fiche=${contactId}`);
  }

  const memberOptions: AssigneeOption[] = members.map((m) => ({
    id: m.id,
    fullName: m.fullName,
  }));

  const title =
    phase === 'review'
      ? 'Vérifiez la note'
      : hasPriorTake
        ? 'Compléter la dictée'
        : 'Dicter une note';

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

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const chrono = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  if (field && (phase === 'recording' || phase === 'processing')) {
    return (
      <div
        className="fixed inset-0 z-[120] flex flex-col bg-bg-base"
        role="dialog"
        aria-modal="true"
        aria-label="Dicter une note"
        style={{ height: '100dvh' }}
      >
        <header
          className="flex flex-shrink-0 items-center justify-between px-4"
          style={{ paddingTop: 'calc(8px + env(safe-area-inset-top, 0px))' }}
        >
          <button
            type="button"
            onClick={cancelRecording}
            aria-label="Annuler la dictée"
            className="app-press flex size-11 items-center justify-center rounded-lg text-text-muted"
          >
            <X size={20} strokeWidth={2} aria-hidden />
          </button>
          <p className="tabular-nums font-semibold text-text-strong" style={{ fontSize: 16 }}>
            {chrono}
          </p>
          <span className="w-16" aria-hidden />
        </header>

        <div
          className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 touch-none"
          onPointerDown={(e) => {
            if (phase !== 'recording' || recordingLocked) return;
            touchStartRef.current = { x: e.clientX, y: e.clientY };
          }}
          onPointerMove={(e) => {
            if (phase !== 'recording' || recordingLocked || !touchStartRef.current) return;
            const deltaY = touchStartRef.current.y - e.clientY;
            const deltaX = e.clientX - touchStartRef.current.x;
            setLockSwipeY(deltaY);
            if (shouldLockVoice(deltaY, deltaX)) {
              setRecordingLocked(true);
              if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([10, 20, 10]);
            }
          }}
          onPointerUp={() => {
            touchStartRef.current = null;
            if (!recordingLocked) setLockSwipeY(0);
          }}
          onPointerCancel={() => {
            touchStartRef.current = null;
            if (!recordingLocked) setLockSwipeY(0);
          }}
        >
          {phase === 'processing' ? (
            <div className="w-full max-w-sm" aria-busy="true" aria-label="Mise en texte de la dictée">
              {transcript.trim() ? (
                <p className="text-pretty text-left text-text" style={{ fontSize: 15 }}>
                  {transcript}
                </p>
              ) : (
                <>
                  <div className="h-3 w-3/4 animate-pulse rounded bg-black/[0.08]" />
                  <div className="mt-3 h-3 w-full animate-pulse rounded bg-black/[0.06]" />
                  <div className="mt-3 h-3 w-2/3 animate-pulse rounded bg-black/[0.06]" />
                </>
              )}
              <p className="mt-6 text-pretty text-center text-text-muted" style={{ fontSize: 14 }}>
                {transcript.trim() ? 'Enregistrement de la note…' : 'Mise en texte de la dictée…'}
              </p>
            </div>
          ) : (
            <>
              <VoiceWaveform stream={micStream} />
              <VoiceLockHint locked={recordingLocked} progress={lockSwipeY} />
              {error ? (
                <p className="mt-6 text-pretty text-center text-text" style={{ fontSize: 14 }}>
                  {error}
                </p>
              ) : null}
              {editingAddress ? (
                <div className="mt-8 w-full max-w-sm text-left">
                  <AddressAutocomplete
                    id="voice-capture-address"
                    aria-label="Adresse"
                    value={gpsAddress ?? ''}
                    onChange={(data) => {
                      if (data) {
                        setGpsAddress(data.label);
                        setEditingAddress(false);
                      }
                    }}
                    onQueryChange={(q) => setGpsAddress(q)}
                    placeholder="Rattacher à un immeuble…"
                    inputClassName={ADDRESS_FIELD_INPUT_CLASS}
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setEditingAddress(true)}
                  className="app-press mt-8 max-w-sm text-pretty text-center text-text-muted"
                  style={{ fontSize: 13 }}
                >
                  {gpsAddress ?? 'Position en cours…'}
                </button>
              )}
            </>
          )}
        </div>

        {phase === 'recording' ? (
          <div
            className="flex flex-shrink-0 justify-center px-6"
            style={{ paddingBottom: 'calc(28px + env(safe-area-inset-bottom, 0px))' }}
          >
            {error && !micReady ? (
              <WorkspaceButton type="button" onClick={() => void startRecording(false)} className="min-h-[48px] w-full max-w-sm">
                Reprendre
              </WorkspaceButton>
            ) : (
              <WorkspaceButton
                type="button"
                onClick={stopRecording}
                disabled={!micReady}
                className="min-h-[48px] w-full max-w-sm"
              >
                <Square size={16} strokeWidth={2} aria-hidden />
                Arrêter
              </WorkspaceButton>
            )}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-[rgba(21,32,47,0.45)] p-4"
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
            className="flex size-9 flex-shrink-0 items-center justify-center rounded-lg text-text-subtle transition-colors hover:bg-black/[0.04] hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
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
            onDiscard={() => {
              router.refresh();
              onClose();
            }}
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
                  {transcript.trim()
                    ? 'Enregistrement de la note…'
                    : hasPriorTake
                      ? 'Mise en forme de ce que vous avez ajouté…'
                      : 'Mise en texte de la dictée…'}
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
                  {hasPriorTake ? 'Ajoutez ce qui manque.' : 'Parlez normalement.'}
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
