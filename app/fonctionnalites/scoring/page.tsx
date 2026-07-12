import FeaturePage from '@/components/features/FeaturePage';
import { SCORING_PAGE } from '@/lib/features/pages';
import { featurePageMetadata } from '@/lib/features/seo';

export const metadata = featurePageMetadata(SCORING_PAGE.meta);

export default function ScoringFeaturePage() {
  return <FeaturePage content={SCORING_PAGE} />;
}
