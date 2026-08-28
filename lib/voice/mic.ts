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
