import FeaturePage from '@/components/features/FeaturePage';
import { PILOTAGE_PAGE } from '@/lib/features/pages';
import { featurePageMetadata } from '@/lib/features/seo';

export const metadata = featurePageMetadata(PILOTAGE_PAGE.meta);

export default function PilotageFeaturePage() {
  return <FeaturePage page={PILOTAGE_PAGE} />;
}
