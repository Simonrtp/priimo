import FeaturePage from '@/components/features/FeaturePage';
import { PIPELINE_PAGE } from '@/lib/features/pages';
import { featurePageMetadata } from '@/lib/features/seo';

export const metadata = featurePageMetadata(PIPELINE_PAGE.meta);

export default function PipelineFeaturePage() {
  return <FeaturePage page={PIPELINE_PAGE} />;
}
