/**
 * Voxtral Realtime : transcription au fil de la parole (≈ 0,5 s de retard).
 * Le texte qui fait foi reste celui de Voxtral Mini Transcribe, relu sur
 * l'enregistrement complet après la dictée.
 */
export const MODELE_TEMPS_REEL =
  process.env.MISTRAL_MODEL_STT_REALTIME?.trim() || 'voxtral-mini-transcribe-realtime-2602';

export const URL_TEMPS_REEL = 'wss://api.mistral.ai/v1/audio/transcriptions/realtime';

/** Compromis latence / justesse : sous 500 ms, l'erreur reste à 1-2 points du différé. */
export const RETARD_CIBLE_MS = 480;

export const FREQUENCE_PCM = 16_000;
