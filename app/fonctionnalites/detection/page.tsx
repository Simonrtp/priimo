import DetectionPage from '@/components/features/detection/DetectionPage';
import { DETECTION_PAGE } from '@/lib/features/pages';
import { featurePageMetadata } from '@/lib/features/seo';

export const metadata = featurePageMetadata(DETECTION_PAGE.meta);

export default function DetectionFeaturePage() {
  return <DetectionPage page={DETECTION_PAGE} />;
}
