import FeaturePage from '@/components/features/FeaturePage';
import { DETECTION_PAGE } from '@/lib/features/pages';
import { featurePageMetadata } from '@/lib/features/seo';

export const metadata = featurePageMetadata(DETECTION_PAGE.meta);

export default function DetectionFeaturePage() {
  return <FeaturePage page={DETECTION_PAGE} />;
}
