'use client';

import VoiceCaptureDialog from '@/components/dashboard/voice/VoiceCaptureDialog';

export default function DicterMobile({
  onClose,
  streamPromise,
  adresse,
}: {
  onClose: () => void;
  streamPromise?: Promise<MediaStream> | null;
  adresse?: string | null;
}) {
  return (
    <VoiceCaptureDialog
      onClose={onClose}
      streamPromise={streamPromise}
      variant="mobile"
      adresse={adresse}
    />
  );
}
