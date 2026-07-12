import LivraisonFeature from '@/components/features/LivraisonFeature';
import { LIVRAISON_PAGE } from '@/lib/features/pages';
import { featurePageMetadata } from '@/lib/features/seo';

export const metadata = featurePageMetadata(LIVRAISON_PAGE.meta);

export default function LivraisonFeaturePage() {
  return <LivraisonFeature />;
}
