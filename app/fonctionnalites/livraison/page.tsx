import FeaturePage from '@/components/features/FeaturePage';
import { LIVRAISON_PAGE } from '@/lib/features/pages';
import { featurePageMetadata } from '@/lib/features/seo';

export const metadata = featurePageMetadata(LIVRAISON_PAGE.meta);

export default function LivraisonFeaturePage() {
  return <FeaturePage content={LIVRAISON_PAGE} />;
}
