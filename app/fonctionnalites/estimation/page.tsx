import FeaturePage from '@/components/features/FeaturePage';
import { ESTIMATION_PAGE } from '@/lib/features/pages';
import { featurePageMetadata } from '@/lib/features/seo';

export const metadata = featurePageMetadata(ESTIMATION_PAGE.meta);

export default function EstimationFeaturePage() {
  return <FeaturePage page={ESTIMATION_PAGE} />;
}
