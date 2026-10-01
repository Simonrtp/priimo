export function pickAudioMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type));
}

/**
 * Débit d'une voix : 32 kb/s en Opus suffit largement à la transcription.
 * Au débit par défaut (jusqu'à 128 kb/s), une dictée de cinq minutes dépassait
 * la taille qu'une fonction Vercel accepte (4,5 Mo) et se perdait à l'envoi.
 */
export const VOICE_BITS_PER_SECOND = 32_000;

/**
 * Au-delà, la prise est arrêtée et envoyée, et l'agent complète s'il le faut.
 * Sous la limite Vercel, formulaire compris, même si le navigateur ignore le
 * débit demandé (Safari).
 */
export const MAX_RECORD_BYTES = 3_800_000;

export function createVoiceRecorder(stream: MediaStream): MediaRecorder {
  const mimeType = pickAudioMimeType();
  const options: MediaRecorderOptions = { audioBitsPerSecond: VOICE_BITS_PER_SECOND };
  if (mimeType) options.mimeType = mimeType;
  try {
    return new MediaRecorder(stream, options);
  } catch {
    return new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  }
}

/**
 * Garde l'écran allumé pendant la dictée : en marchant, le téléphone qui se
 * verrouille coupe le micro sur iPhone. Sans Wake Lock (vieux navigateurs),
 * rien ne se passe. Rend une fonction qui relâche le verrou.
 */
export function holdScreenAwake(): () => void {
  type WakeLockLike = { release: () => Promise<void> };
  if (typeof navigator === 'undefined' || typeof document === 'undefined') return () => undefined;
  const wakeLock = (navigator as Navigator & {
    wakeLock?: { request: (type: 'screen') => Promise<WakeLockLike> };
  }).wakeLock;
  if (!wakeLock) return () => undefined;

  let sentinel: WakeLockLike | null = null;
  let released = false;

  const acquire = () => {
    if (released || document.visibilityState !== 'visible') return;
    wakeLock
      .request('screen')
      .then((s) => {
        if (released) void s.release().catch(() => undefined);
        else sentinel = s;
      })
      .catch(() => undefined);
  };
  // Le navigateur relâche le verrou quand l'onglet passe en arrière-plan.
  const onVisible = () => {
    if (document.visibilityState === 'visible') acquire();
  };

  acquire();
  document.addEventListener('visibilitychange', onVisible);
  return () => {
    released = true;
    document.removeEventListener('visibilitychange', onVisible);
    void sentinel?.release().catch(() => undefined);
    sentinel = null;
  };
}

/** Identifiant tiré par le téléphone : il rend l'envoi rejouable sans doublon. */
export function newClientId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  const hex = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export function micErrorMessage(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError') {
      return "Accès au micro refusé. Autorisez le micro dans les paramètres du navigateur, puis réessayez.";
    }
    if (error.name === 'NotFoundError') {
      return "Aucun micro détecté. Branchez ou activez un micro, puis réessayez.";
    }
    if (error.name === 'NotReadableError') {
      return "Le micro est utilisé par une autre application. Fermez-la, puis réessayez.";
    }
    if (error.name === 'SecurityError' || error.name === 'NotSupportedError') {
      return "Le micro n'est disponible que sur une connexion sécurisée (https ou localhost).";
    }
  }
  return "Le micro n'est pas accessible. Vérifiez l'autorisation du navigateur.";
}

/** À appeler dans le même tick que le clic, sinon Safari perd le geste utilisateur. */
export function requestMicStream(): Promise<MediaStream> {
  if (typeof window === 'undefined' || !window.isSecureContext) {
    return Promise.reject(new DOMException('Insecure context', 'SecurityError'));
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    return Promise.reject(new DOMException('getUserMedia missing', 'NotSupportedError'));
  }
  return navigator.mediaDevices.getUserMedia({ audio: true });
}

export function stopMicStream(stream: MediaStream | null | undefined): void {
  stream?.getTracks().forEach((track) => track.stop());
}

/**
 * État de l'autorisation micro, sans la demander.
 *
 * Permissions API absente (Safari ancien, WebView) : on répond 'prompt' —
 * l'inconnu se traite comme un « peut-être », jamais comme un refus, sinon on
 * priverait de la dictée des navigateurs qui l'acceptent très bien.
 */
export async function micPermissionState(): Promise<'granted' | 'denied' | 'prompt'> {
  if (typeof navigator === 'undefined') return 'prompt';
  if (!navigator.mediaDevices?.getUserMedia) return 'denied';
  if (!navigator.permissions?.query) return 'prompt';
  try {
    const status = await navigator.permissions.query({
      name: 'microphone' as PermissionName,
    });
    return status.state;
  } catch {
    return 'prompt';
  }
}
