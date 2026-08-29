'use client';

import VoiceCaptureDialog from '@/components/dashboard/voice/VoiceCaptureDialog';

export default function DicterMobile({
  onClose,
  streamPromise,
  adresse,
  parcelleId,
  resterSurPage,
}: {
  onClose: () => void;
  streamPromise?: Promise<MediaStream> | null;
  adresse?: string | null;
  parcelleId?: string | null;
  resterSurPage?: boolean;
}) {
  return (
    <VoiceCaptureDialog
      onClose={onClose}
      streamPromise={streamPromise}
      variant="mobile"
      adresse={adresse}
      parcelleId={parcelleId}
      resterSurPage={resterSurPage}
    />
  );
}
