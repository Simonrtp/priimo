export type DeviceKind = 'mobile' | 'desktop';

export const DEVICE_COOKIE = 'priimo-device';

/**
 * Détection d’appareil par user-agent, côté serveur.
 * Un iPad de terrain est traité comme mobile.
 */
export function deviceFromUserAgent(ua: string): DeviceKind {
  if (/iPad|Tablet|PlayBook/i.test(ua)) return 'mobile';
  if (/Mobile|iP(hone|od)|Android|BlackBerry|IEMobile|Opera Mini|webOS|Kindle|Silk/i.test(ua)) {
    return 'mobile';
  }
  return 'desktop';
}

export function deviceFromCookie(cookieHeader: string | null | undefined): DeviceKind | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/(?:^|;\s*)priimo-device=(mobile|desktop)(?:;|$)/);
  const value = match?.[1];
  return value === 'mobile' || value === 'desktop' ? value : null;
}

export function deviceFromHints(args: {
  ua: string;
  chMobile?: string | null;
  cookie?: string | null;
}): DeviceKind {
  const fromCookie = deviceFromCookie(args.cookie);
  if (fromCookie) return fromCookie;
  if (args.chMobile === '?1') return 'mobile';
  if (args.chMobile === '?0') {
    // Chrome en mode appareil envoie parfois encore un UA d’ordinateur.
    // On ne force desktop que si l’UA n’est pas déjà un téléphone.
    const fromUa = deviceFromUserAgent(args.ua);
    if (fromUa === 'mobile') return 'mobile';
    return 'desktop';
  }
  return deviceFromUserAgent(args.ua);
}
