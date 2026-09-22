'use client';

import VoiceCaptureDialog from '@/components/dashboard/voice/VoiceCaptureDialog';
import type { VoiceCapturePurpose } from '@/components/dashboard/voice/VoiceCaptureProvider';
import type { EstimationVoiceApplyOpts, EstimationVoiceDraft } from '@/lib/estimation/voice-extract';

export default function DicterMobile({
  onClose,
  streamPromise,
  adresse,
  parcelleId,
  banId,
  resterSurPage,
  purpose = 'note',
  onEstimationDraft,
}: {
  onClose: () => void;
  streamPromise?: Promise<MediaStream> | null;
  adresse?: string | null;
  parcelleId?: string | null;
  banId?: string | null;
  resterSurPage?: boolean;
  purpose?: VoiceCapturePurpose;
  onEstimationDraft?: (draft: EstimationVoiceDraft, opts?: EstimationVoiceApplyOpts) => void;
}) {
  return (
    <VoiceCaptureDialog
      onClose={onClose}
      streamPromise={streamPromise}
      variant="mobile"
      adresse={adresse}
      parcelleId={parcelleId}
      banId={banId}
      resterSurPage={resterSurPage}
      purpose={purpose}
      onEstimationDraft={onEstimationDraft}
    />
  );
}
