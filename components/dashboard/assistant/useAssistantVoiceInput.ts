'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fileNameForAudioBlob,
  isVoiceBlobTooSmall,
  MIN_VOICE_RECORD_MS,
} from '@/lib/voice/audio-blob';
import { notifyError } from '@/lib/notify';
import { micErrorMessage, pickAudioMimeType, requestMicStream, stopMicStream } from '@/lib/voice/mic';

const MAX_LISTEN_MS = 20_000;

function stopMediaRecorder(recorder: MediaRecorder): void {
  if (recorder.state !== 'recording') return;
  try {
    recorder.requestData();
  } catch {
    /* optionnel selon navigateur */
  }
  recorder.stop();
}

/**
 * Enregistrement + transcription via `/api/assistant/voix`.
 * Aucune note créée — texte seulement.
 */
export function useAssistantVoiceInput(
  onText: (text: string) => void,
  labels?: {
    idle?: string;
    listening?: string;
    transcribing?: string;
  },
) {
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const listenTimerRef = useRef<number>(0);
  const minDurationTimerRef = useRef<number>(0);
  const startedAtRef = useRef(0);
  const mimeRef = useRef<string | undefined>(undefined);
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);

  useEffect(() => {
    return () => {
      window.clearTimeout(listenTimerRef.current);
      window.clearTimeout(minDurationTimerRef.current);
      recorderRef.current?.stop();
      stopMicStream(streamRef.current);
    };
  }, []);

  const transcribe = useCallback(async (blob: Blob) => {
    if (blob.size === 0) {
      notifyError('Aucun son reçu.');
      return;
    }
    if (isVoiceBlobTooSmall(blob.size)) {
      notifyError('Enregistrement trop court. Parlez au moins une seconde.');
      return;
    }
    setTranscribing(true);
    try {
      const form = new FormData();
      form.append('audio', blob, fileNameForAudioBlob(blob, 'question'));
      const res = await fetch('/api/assistant/voix', { method: 'POST', body: form });
      const data = (await res.json()) as { text?: string; error?: string };
      if (!res.ok || !data.text?.trim()) {
        notifyError(data.error ?? "La question vocale n'a pas pu être comprise");
        return;
      }
      onTextRef.current(data.text.trim());
    } catch {
      notifyError("La question vocale n'a pas pu être comprise");
    } finally {
      setTranscribing(false);
    }
  }, []);

  const finishRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== 'recording') {
      setListening(false);
      return;
    }
    setListening(false);
    setTranscribing(true);
    stopMediaRecorder(recorder);
  }, []);

  const start = useCallback(async () => {
    try {
      const stream = await requestMicStream();
      streamRef.current = stream;
      const mime = pickAudioMimeType();
      mimeRef.current = mime;
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stopMicStream(stream);
        streamRef.current = null;
        recorderRef.current = null;
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || mime || 'audio/webm',
        });
        void transcribe(blob);
      };
      recorder.start(200);
      recorderRef.current = recorder;
      startedAtRef.current = Date.now();
      setListening(true);
      window.clearTimeout(listenTimerRef.current);
      listenTimerRef.current = window.setTimeout(finishRecording, MAX_LISTEN_MS);
    } catch (error) {
      notifyError(micErrorMessage(error));
    }
  }, [finishRecording, transcribe]);

  const toggle = useCallback(() => {
    if (transcribing) return;
    if (listening) {
      window.clearTimeout(listenTimerRef.current);
      window.clearTimeout(minDurationTimerRef.current);
      const elapsed = Date.now() - startedAtRef.current;
      if (elapsed < MIN_VOICE_RECORD_MS) {
        setListening(false);
        setTranscribing(true);
        minDurationTimerRef.current = window.setTimeout(
          finishRecording,
          MIN_VOICE_RECORD_MS - elapsed,
        );
        return;
      }
      finishRecording();
      return;
    }
    void start();
  }, [listening, transcribing, start, finishRecording]);

  const voiceLabel = transcribing
    ? (labels?.transcribing ?? 'Mise en texte de la question')
    : listening
      ? (labels?.listening ?? "Arrêter l'écoute")
      : (labels?.idle ?? 'Question vocale');

  return { listening, transcribing, toggle, voiceLabel };
}
