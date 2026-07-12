import SciFeature from '@/components/features/SciFeature';
import { SCI_PAGE } from '@/lib/features/pages';
import { featurePageMetadata } from '@/lib/features/seo';

export const metadata = featurePageMetadata(SCI_PAGE.meta);

export default function SciFeaturePage() {
  return <SciFeature />;
}
