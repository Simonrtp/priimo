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
import VoiceReviewPanel, { type PlanRangement } from './VoiceReviewPanel';
import EcranDictee from './live/EcranDictee';
import { useComprehensionEnDirect } from './live/useComprehensionEnDirect';
import { useUser } from '@/lib/hooks/useUser';
import type { NameMatchMember } from '@/lib/agency/match-member';
import { emptyReviewPayload, type NoteReviewPayload } from '@/lib/notes/build-review';
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
import {
  preparerTempsReel,
  TranscriptionTempsReel,
  type PreparationTempsReel,
} from '@/lib/voice/temps-reel';
import { finDeNoteDite, retirerFinDeNote } from '@/lib/voice/fin-de-note';
import { cartesDepuisReview } from '@/lib/voice/cartes';
import { cartesLocales, fusionnerCartes } from '@/lib/voice/cartes-locales';
import { rangerEnArrierePlan, type ResultatEnvoi } from '@/lib/voice/rangement';
import type { AssigneeOption } from '@/components/dashboard/workspace/AssigneeSelect';
import type { EstimationVoiceApplyOpts, EstimationVoiceDraft } from '@/lib/estimation/voice-extract';
import { voiceDraftKeys } from '@/lib/estimation/voice-extract';
import { ditSurfaceLogement, extractEstimationHeuristic } from '@/lib/estimation/voice-heuristic';
import { enqueueJson, postFormOrQueue } from '@/lib/offline/queue';
import { useTourneeDictation } from '@/components/dashboard/field/TourneeDictationProvider';
import { emitNoteCreated } from '@/lib/notes/note-created-event';
import { demanderAMonAssistant } from '@/lib/assistant/question-event';
import { cibleEnvolNote, envolerNote } from '@/lib/ui/envol-note';

type Phase = 'recording' | 'processing' | 'review';

/** Une lecture automatique ne repart jamais sans l'identifiant et la visibilité déjà connus. */
function adopter(lue: NoteReviewPayload, prev: NoteReviewPayload | null, transcript: string): NoteReviewPayload {
  return {
    ...lue,
    voiceNoteId: prev?.voiceNoteId ?? lue.voiceNoteId,
    visibilite: prev?.visibilite ?? lue.visibilite,
    transcript,
    // Le brouillon d'e-mail rédigé par la lecture complète survit aux lectures rapides.
    email: lue.email
      ? { ...lue.email, corps: lue.email.corps || (prev?.email?.corps ?? '') }
      : lue.email,
  };
}

export default function VoiceCaptureDialog({
  onClose,
  streamPromise,
  preparation = null,
  modeInitial = 'voix',
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
  /** Direct préparé dans le geste qui a ouvert la dictée. */
  preparation?: PreparationTempsReel | null;
  /** « ecrit » : la même feuille, au clavier — pour les agents qui préfèrent écrire. */
  modeInitial?: 'voix' | 'ecrit';
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
  /** L'agent a corrigé une carte : plus aucune lecture automatique n'écrase rien. */
  const [touche, setTouche] = useState(false);
  const [lectureComplete, setLectureComplete] = useState(false);
  /** Prises parties au serveur dont la transcription finale n'est pas revenue. */
  const [envoisEnCours, setEnvoisEnCours] = useState(0);
  /** À la voix, ou au clavier dans la même feuille. */
  const [mode, setMode] = useState<'voix' | 'ecrit'>(estimationMode ? 'voix' : modeInitial);
  const field = variant === 'mobile';

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number>(0);
  const autoStartedRef = useRef(false);
  const usedInitialStreamRef = useRef(false);
  const cancelledRef = useRef(false);
  const transcriptRef = useRef(transcript);
  const toucheRef = useRef(touche);
  const gpsRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const liveInFlightRef = useRef(false);
  const liveTextRef = useRef('');
  const takeBaseRef = useRef('');
  const mimeRef = useRef('audio/webm');
  /** Identifiant de la note tiré à l’ouverture : un renvoi ne la duplique pas. */
  const clientNoteIdRef = useRef(newClientId());
  const recordedAtRef = useRef(recordedAt);
  const releaseWakeRef = useRef<() => void>(() => undefined);
  const preparationRef = useRef<PreparationTempsReel | null>(preparation);
  const tempsReelRef = useRef<TranscriptionTempsReel | null>(null);
  const finTempsReelRef = useRef<Promise<string> | null>(null);
  const flushTimerRef = useRef(0);
  /** Envoi de la note : l'enregistrement part au serveur pendant que l'agent relit. */
  const envoiRef = useRef<Promise<ResultatEnvoi> | null>(null);
  /** L'agent a retouché le texte : la transcription finale ne le remplace plus. */
  const texteEditeRef = useRef(false);
  /** La prise en cours est abandonnée pour écrire : elle ne part pas. */
  const abandonPriseRef = useRef(false);
  const stopRef = useRef<() => void>(() => undefined);
  /** La feuille de la note : elle rétrécit en un point quand la note est rangée. */
  const feuilleRef = useRef<HTMLDivElement | null>(null);
  const draftCbRef = useRef(onEstimationDraft);
  const extractTimerRef = useRef(0);
  const extractBusyRef = useRef(false);
  const extractAttenteRef = useRef<string | null>(null);
  const extractVuRef = useRef('');

  useLayoutEffect(() => {
    transcriptRef.current = transcript;
    toucheRef.current = touche;
    draftCbRef.current = onEstimationDraft;
  });

  // Ce que Priimo comprend, pendant la dictée puis tant que l'agent ne corrige rien.
  const {
    review: reviewDirect,
    enCours: lectureDirect,
    relire,
  } = useComprehensionEnDirect(transcript, {
    actif: !estimationMode && !touche,
    banId: banId ?? banGps,
    recordedAt,
  });

  useEffect(() => {
    if (!reviewDirect || touche) return;
    setReview((prev) => adopter(reviewDirect, prev, transcriptRef.current));
  }, [reviewDirect, touche]);

  // Pendant la dictée : les cartes du modèle, complétées au mot près par le téléphone.
  const cartes = useMemo(
    () => fusionnerCartes(cartesDepuisReview(reviewDirect), estimationMode ? [] : cartesLocales(transcript)),
    [reviewDirect, transcript, estimationMode],
  );

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
    void readDevicePosition().then(async (pos) => {
      gpsRef.current = pos;
      if (!pos) return;
      const hit = await reverseGeocode(pos.latitude, pos.longitude);
      if (!hit) return;
      setBanGps(hit.ban_id);
      if (!adresse) setGpsAddress(hit.adresse_normalisee);
    });
  }, [adresse, estimationMode]);

  useEffect(() => {
    return () => {
      releaseWakeRef.current();
      window.clearTimeout(flushTimerRef.current);
      tempsReelRef.current?.fermer();
      tempsReelRef.current = null;
      preparationRef.current?.abandonner();
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

  /** Texte final du direct (au plus 1,5 s d'attente), débarrassé de « fin de note ». */
  async function texteDirectFinal(): Promise<string> {
    const fin = finTempsReelRef.current;
    finTempsReelRef.current = null;
    const texte = fin ? await fin.catch(() => liveTextRef.current) : liveTextRef.current;
    const propre = retirerFinDeNote(texte || liveTextRef.current);
    liveTextRef.current = propre;
    return propre;
  }

  async function uploadEstimation(blob: Blob) {
    const directFinal = await texteDirectFinal();
    const preview = joinVoiceTranscripts(takeBaseRef.current, directFinal);
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

  /**
   * La prise est terminée : la note s'affiche tout de suite, avec ce qui a déjà
   * été compris. L'enregistrement part au serveur en arrière-plan.
   */
  function terminerPrise(blob: Blob, durationSeconds: number) {
    if (estimationMode) {
      void uploadEstimation(blob);
      return;
    }
    releaseMic();
    setError(null);
    const vu = joinVoiceTranscripts(takeBaseRef.current, retirerFinDeNote(liveTextRef.current));
    setTranscript(vu);
    if (!toucheRef.current) relire(vu);
    setPhase('review');

    if (blob.size === 0) {
      notifyError('Aucun son reçu.');
      return;
    }
    const precedent = envoiRef.current;
    setEnvoisEnCours((n) => n + 1);
    envoiRef.current = envoyer(blob, durationSeconds, precedent).finally(() =>
      setEnvoisEnCours((n) => n - 1),
    );
  }

  async function envoyer(
    blob: Blob,
    durationSeconds: number,
    precedent: Promise<ResultatEnvoi> | null,
  ): Promise<ResultatEnvoi> {
    const base = takeBaseRef.current.trim();
    const directFinal = await texteDirectFinal();
    // La fin du direct arrive après l'arrêt : elle complète le texte s'il n'a pas été retouché.
    if (!texteEditeRef.current) {
      const complet = joinVoiceTranscripts(base, directFinal);
      if (complet.trim() && complet !== transcriptRef.current) {
        setTranscript(complet);
        if (!toucheRef.current) relire(complet);
      }
    }

    const avant = precedent ? await precedent : null;
    const continueId = avant && 'id' in avant ? avant.id : null;

    const form = new FormData();
    form.append('audio', blob, 'dictee.webm');
    form.append('durationSeconds', String(durationSeconds));
    if (base) form.append('previousTranscript', base);
    // Secours : si la transcription finale échoue, le serveur garde ce texte.
    if (directFinal.trim()) form.append('liveTranscript', directFinal.trim());
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

    try {
      const { queued, res } = await postFormOrQueue('/api/dashboard/voice-notes', form, {
        // Rejouée plus tard, personne ne relira la note à l’écran : le serveur la lit.
        champsSiDifferee: { extraireSurServeur: '1' },
      });
      if (queued) {
        emitNoteCreated({ noteId: null, source: 'vocal' });
        if (tourAdresse) noteDictee();
        return { horsLigne: true };
      }
      if (!res) throw new Error('réseau');
      const data = (await res.json()) as NoteReviewPayload & {
        suggestedAssignee?: { id: string; fullName: string } | null;
        extractionPending?: boolean;
        error?: string;
      };
      if (!res.ok) {
        notifyError(data.error ?? "La dictée n'a pas pu être enregistrée");
        return { erreur: data.error ?? 'envoi' };
      }
      if (cancelledRef.current) {
        if (!continueId) void fetch(`/api/dashboard/voice-notes/${data.voiceNoteId}`, { method: 'DELETE' });
        return { erreur: 'annulée' };
      }

      emitNoteCreated({ noteId: data.voiceNoteId ?? null, source: 'vocal' });
      if (tourAdresse) noteDictee();
      setVoiceNoteId(data.voiceNoteId);
      setSuggestedAssigneeId(data.suggestedAssignee?.id ?? null);
      setReview((prev) => (prev ? { ...prev, voiceNoteId: data.voiceNoteId, visibilite: data.visibilite } : prev));

      // Le texte du différé est plus juste que celui du direct : il le remplace
      // tant que l'agent n'y a pas touché.
      const finalTexte = data.transcript ?? '';
      if (finalTexte && !texteEditeRef.current && finalTexte !== transcriptRef.current) {
        setTranscript(finalTexte);
      }

      // Lecture complète (rédaction de l'e-mail, adresse géocodée, prospect) :
      // elle arrive quand elle arrive, sans rien bloquer.
      if (data.extractionPending && data.voiceNoteId && finalTexte.trim()) {
        setLectureComplete(true);
        void hydrateNoteReview(data.voiceNoteId, finalTexte)
          .then((lue) => {
            if (!lue) return;
            setReview((prev) => {
              if (!toucheRef.current) return adopter(lue, prev, transcriptRef.current);
              // Corrigée à la main : on n'ajoute que le brouillon d'e-mail.
              if (prev?.email && !prev.email.corps && lue.email?.corps) {
                return { ...prev, email: { ...prev.email, corps: lue.email.corps } };
              }
              return prev;
            });
          })
          .finally(() => setLectureComplete(false));
      }
      return { id: data.voiceNoteId };
    } catch {
      notifyError("La dictée n'a pas pu être envoyée");
      return { erreur: 'réseau' };
    }
  }

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
  const terminerRef = useRef(terminerPrise);

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
    const prep = preparationRef.current;
    preparationRef.current = null;

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
        prep?.abandonner();
        return;
      }

      const recorder = createVoiceRecorder(stream);
      mimeRef.current = recorder.mimeType || 'audio/webm';
      chunksRef.current = [];
      liveTextRef.current = '';
      texteEditeRef.current = false;
      abandonPriseRef.current = false;
      takeBaseRef.current = transcriptRef.current;
      setBasePrise(transcriptRef.current);
      if (!envoiRef.current) {
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
          notifySuccess('Dictée longue enregistrée. Touchez le micro pour continuer.');
        }
      };
      recorder.onstop = () => {
        window.clearTimeout(flushTimerRef.current);
        releaseWakeRef.current();
        releaseWakeRef.current = () => undefined;
        const durationSeconds = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
        stopMicStream(stream);
        setMicStream(null);

        if (cancelledRef.current || abandonPriseRef.current) {
          chunksRef.current = [];
          if (recorderRef.current === recorder) recorderRef.current = null;
          return;
        }

        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        recorderRef.current = null;
        terminerRef.current(blob, durationSeconds);
      };

      recorder.start(250);
      recorderRef.current = recorder;
      startedAtRef.current = Date.now();
      setDemarreLe(startedAtRef.current);
      setMicStream(stream);
      setMicReady(true);

      // Le direct, préparé dès le toucher du micro, se branche sur le flux.
      void TranscriptionTempsReel.demarrer(
        stream,
        {
          onTexte: (t) => recevoirRef.current(t),
          onCoupure: () => {
            tempsReelRef.current = null;
            if (recorderRef.current === recorder && recorder.state === 'recording') basculerSurMorceaux(recorder);
          },
        },
        prep,
      ).then((session) => {
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
      prep?.abandonner();
      if (estimationMode) {
        notifyError(micErrorMessage(err));
        onClose();
        return;
      }
      // Micro refusé ou absent : la note s'écrit, la feuille reste ouverte.
      notifyError(`${micErrorMessage(err)} Vous pouvez écrire votre note.`);
      setMode('ecrit');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estimationMode, onClose, streamPromise]);

  useEffect(() => {
    if (autoStartedRef.current) return;
    autoStartedRef.current = true;
    // Ouverte au clavier : pas de micro à demander.
    if (mode === 'ecrit') {
      preparationRef.current?.abandonner();
      preparationRef.current = null;
      return;
    }
    // Le flux micro a été demandé dans le geste (fournisseur) : démarrer juste
    // après le montage ne perd rien.
    queueMicrotask(() => void startRecording(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    recevoirRef.current = recevoirTexteDirect;
    terminerRef.current = terminerPrise;
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
    if (takeBaseRef.current.trim() || envoiRef.current) {
      cancelledRef.current = false;
      setPhase('review');
      return;
    }
    onClose();
  }

  useEffect(() => {
    if (phase !== 'review' || members.length > 0) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch('/api/team');
        const data = (await res.json()) as { members?: NameMatchMember[] };
        if (!cancelled) setMembers(data.members ?? []);
      } catch {
        /* sans l'équipe, la note se range quand même */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [phase, members.length]);

  function continueRecording() {
    // Dans le geste : le direct de la prise suivante se prépare tout de suite.
    preparationRef.current = preparerTempsReel();
    setMode('voix');
    playRecordStartSound();
    void startRecording(false);
  }

  /* --------------------------------------------------------- Au clavier */

  /**
   * L'agent préfère écrire : le micro s'arrête sans rien envoyer, ce qui a déjà
   * été dit devient le début du texte, et la même feuille passe au clavier.
   */
  function passerAEcrire() {
    if (recorderRef.current?.state === 'recording') {
      abandonPriseRef.current = true;
      couperDirect();
      recorderRef.current.stop();
    }
    releaseMic();
    setTranscript(joinVoiceTranscripts(takeBaseRef.current, retirerFinDeNote(liveTextRef.current)));
    texteEditeRef.current = true;
    setError(null);
    setMode('ecrit');
  }

  function ecrire(texte: string) {
    texteEditeRef.current = true;
    setTranscript(texte);
  }

  /** La note écrite est finie : même relecture, même rangement que la voix. */
  function terminerEcrit() {
    const texte = transcriptRef.current.trim();
    if (texte.length < 3) {
      setError('Écrivez quelques mots avant de terminer.');
      return;
    }
    setError(null);
    if (!toucheRef.current) relire(texte);
    setPhase('review');
    // Une prise dictée a déjà créé la note : le texte écrit la complète.
    if (!envoiRef.current) envoiRef.current = envoyerEcrit(texte);
  }

  async function envoyerEcrit(texte: string): Promise<ResultatEnvoi> {
    const gps = gpsRef.current;
    const corps = {
      text: texte,
      adresse: gpsAddress?.trim() || undefined,
      latitude: gps?.latitude,
      longitude: gps?.longitude,
      parcelleId: parcelleId || undefined,
      liens: banId ? [{ entiteType: 'immeuble', entiteId: banId }] : [],
    };
    try {
      const res = await fetch('/api/dashboard/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corps),
      });
      const data = (await res.json().catch(() => ({}))) as { voiceNoteId?: string; error?: string };
      if (!res.ok || !data.voiceNoteId) {
        notifyError(data.error ?? "La note n'a pas pu être enregistrée");
        return { erreur: data.error ?? 'envoi' };
      }
      emitNoteCreated({ noteId: data.voiceNoteId, source: 'clavier' });
      if (tourAdresse) noteDictee();
      setVoiceNoteId(data.voiceNoteId);
      setReview((prev) => (prev ? { ...prev, voiceNoteId: data.voiceNoteId! } : prev));
      // Lecture complète (rédaction de l'e-mail, adresse géocodée), sans rien bloquer.
      setLectureComplete(true);
      void hydrateNoteReview(data.voiceNoteId, texte)
        .then((lue) => {
          if (!lue) return;
          setReview((prev) => {
            if (!toucheRef.current) return adopter(lue, prev, transcriptRef.current);
            if (prev?.email && !prev.email.corps && lue.email?.corps) {
              return { ...prev, email: { ...prev.email, corps: lue.email.corps } };
            }
            return prev;
          });
        })
        .finally(() => setLectureComplete(false));
      return { id: data.voiceNoteId };
    } catch {
      // Pas de réseau : la note attend sur le téléphone et partira seule.
      await enqueueJson({ url: '/api/dashboard/notes', body: corps });
      return { horsLigne: true };
    }
  }

  function ranger(plan: PlanRangement, depart?: DOMRect) {
    rangerEnArrierePlan({
      envoi: envoiRef.current ?? Promise.resolve({ erreur: 'aucun enregistrement' }),
      plan,
      apres: () => router.refresh(),
    });
    // Une note rangée (contact ou adresse) fait monter Notes terrain.
    const liens = Array.isArray(plan.liens) ? (plan.liens as { entiteType?: string }[]) : [];
    const echange = liens.some((l) => l.entiteType === 'contact');
    const rattachee = Boolean(
      parcelleId ||
        banId ||
        gpsRef.current ||
        liens.some((l) => l.entiteType === 'immeuble' || l.entiteType === 'parcelle'),
    );
    envolerNote({
      feuille: feuilleRef.current,
      depart,
      voile: field ? 'rgba(26,42,86,0.42)' : 'rgba(26,42,86,0.45)',
      compte: echange || rattachee,
      cible: cibleEnvolNote({ echange, rattachee }),
    });
    onClose();
  }

  /** La dictée était une question : la note s'efface, Mon assistant répond. */
  function passerAMonAssistant(question: string) {
    void envoiRef.current?.then((r) => {
      if ('id' in r) void fetch(`/api/dashboard/voice-notes/${r.id}`, { method: 'DELETE' });
    });
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
        mode={mode}
        onStop={stopRecording}
        onCancel={
          mode === 'ecrit'
            ? () => (envoiRef.current ? setPhase('review') : onClose())
            : cancelRecording
        }
        onRetry={() => void startRecording(false)}
        onEcrire={estimationMode ? undefined : passerAEcrire}
        onDicter={continueRecording}
        onTexte={ecrire}
        onTerminerEcrit={terminerEcrit}
      />
    );
  }

  const affichee = review ?? emptyReviewPayload(voiceNoteId ?? 'en-cours', transcript || null);
  const titre = affichee.titre ?? 'Votre note';

  const contenu = (
    <>
      <header className="flex flex-shrink-0 items-center gap-3 px-5 pb-2 pt-4">
        <h2 className="min-w-0 flex-1 truncate font-display text-[17px] font-semibold text-text-strong">{titre}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer — la note reste dans vos notes"
          className="flex size-9 flex-shrink-0 items-center justify-center rounded-full text-text-subtle transition-colors hover:bg-black/[0.04] hover:text-text"
        >
          <X size={18} strokeWidth={2} aria-hidden />
        </button>
      </header>
      <VoiceReviewPanel
        review={affichee}
        transcript={transcript}
        onTranscript={(v) => {
          texteEditeRef.current = true;
          setTranscript(v);
        }}
        onTexteCorrige={() => {
          // Le texte corrigé fait foi : les cartes le suivent.
          setTouche(false);
          relire(transcriptRef.current);
        }}
        onReviewChange={(r) => {
          setTouche(true);
          setReview(r);
        }}
        onToucher={() => setTouche(true)}
        members={memberOptions}
        currentUserId={profile?.id}
        suggestedAssigneeId={suggestedAssigneeId}
        onContinue={continueRecording}
        onRanger={ranger}
        onQuestion={passerAMonAssistant}
        lecture={lectureDirect || lectureComplete}
        transcriptionEnCours={envoisEnCours > 0}
        cartesEnAttente={cartesLocales(transcript)}
      />
    </>
  );

  if (field) {
    return (
      <div className="fixed inset-0 z-[220] flex flex-col justify-end bg-[rgba(26,42,86,0.42)]" role="presentation">
        <div
          ref={feuilleRef}
          role="dialog"
          aria-modal="true"
          aria-label={titre}
          className="flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-clay-xl bg-surface shadow-clay-lg"
        >
          <div className="flex justify-center pt-2.5" aria-hidden>
            <span className="h-1 w-10 rounded-full bg-black/10" />
          </div>
          {contenu}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center bg-[rgba(26,42,86,0.45)] p-4" role="presentation">
      <div
        ref={feuilleRef}
        role="dialog"
        aria-modal="true"
        aria-label={titre}
        className="flex max-h-[88vh] w-full max-w-[560px] flex-col overflow-hidden rounded-clay-lg bg-surface shadow-clay-lg"
      >
        {contenu}
      </div>
    </div>
  );
}
