import ScoringFeature from '@/components/features/ScoringFeature';
import { SCORING_PAGE } from '@/lib/features/pages';
import { featurePageMetadata } from '@/lib/features/seo';

export const metadata = featurePageMetadata(SCORING_PAGE.meta);

export default function ScoringFeaturePage() {
  return <ScoringFeature />;
}
