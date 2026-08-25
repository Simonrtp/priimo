'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DEVICE_COOKIE, deviceFromUserAgent, type DeviceKind } from '@/lib/device';

const PHONE_MQ = '(max-width: 768px)';

function writeDeviceCookie(value: DeviceKind) {
  document.cookie = `${DEVICE_COOKIE}=${value}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

/**
 * Le mode appareil de Chrome ne change pas toujours le user-agent envoyé au
 * serveur. Si la fenêtre est un téléphone, on pose un cookie et on recharge
 * le HTML terrain. Un vrai téléphone n’y passe pas : l’UA suffit déjà.
 */
export default function DeviceSync({ serverDevice }: { serverDevice: DeviceKind }) {
  const router = useRouter();

  useEffect(() => {
    const phoneViewport = window.matchMedia(PHONE_MQ).matches;
    const uaDevice = deviceFromUserAgent(navigator.userAgent);

    if (phoneViewport && serverDevice === 'desktop') {
      writeDeviceCookie('mobile');
      router.refresh();
      return;
    }

    if (!phoneViewport && serverDevice === 'mobile' && uaDevice === 'desktop') {
      writeDeviceCookie('desktop');
      router.refresh();
    }
  }, [serverDevice, router]);

  return null;
}
