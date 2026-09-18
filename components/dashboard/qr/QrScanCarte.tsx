'use client';

import { useState } from 'react';
import { QrCode } from 'lucide-react';
import { prefetchQrCard } from '@/lib/qr/client-session';
import QrTerrainOverlay from './QrTerrainOverlay';

export default function QrScanCarte() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onPointerEnter={prefetchQrCard}
        onFocus={prefetchQrCard}
        onClick={() => setOpen(true)}
        aria-label="Conformité"
        className="flex h-full min-h-0 w-full flex-col items-center justify-center rounded-clay-lg px-3.5 py-2 shadow-clay-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        style={{ backgroundColor: '#DCEBFF' }}
      >
        <QrCode size={22} strokeWidth={2.15} className="text-[#3D5A80]" aria-hidden />
        <span className="mt-1 text-[13px] font-semibold text-[#111]">Conformité</span>
      </button>
      {open ? <QrTerrainOverlay onClose={() => setOpen(false)} /> : null}
    </>
  );
}
