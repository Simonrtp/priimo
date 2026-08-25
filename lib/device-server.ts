import { cache } from 'react';
import { headers } from 'next/headers';
import { deviceFromHints, type DeviceKind } from '@/lib/device';

export const getDevice = cache(async function getDevice(): Promise<DeviceKind> {
  const h = await headers();
  return deviceFromHints({
    ua: h.get('user-agent') ?? '',
    chMobile: h.get('sec-ch-ua-mobile'),
    cookie: h.get('cookie'),
  });
});
