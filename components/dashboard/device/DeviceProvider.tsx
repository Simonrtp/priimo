'use client';

import { createContext, useContext } from 'react';
import type { DeviceKind } from '@/lib/device';

const DeviceContext = createContext<DeviceKind>('desktop');

export function useDevice(): DeviceKind {
  return useContext(DeviceContext);
}

export default function DeviceProvider({
  device,
  children,
}: {
  device: DeviceKind;
  children: React.ReactNode;
}) {
  return <DeviceContext.Provider value={device}>{children}</DeviceContext.Provider>;
}
