import FeaturePage from '@/components/features/FeaturePage';
import { TERRAIN_PAGE } from '@/lib/features/pages';
import { featurePageMetadata } from '@/lib/features/seo';

export const metadata = featurePageMetadata(TERRAIN_PAGE.meta);

export default function TerrainFeaturePage() {
  return <FeaturePage page={TERRAIN_PAGE} />;
}
