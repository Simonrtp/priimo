import FonctionnaliteTiimePage from "@/components/features/FonctionnaliteTiimePage";
import { DETECTION_PAGE } from "@/lib/features/pages";
import { featurePageMetadata } from "@/lib/features/seo";

export const metadata = featurePageMetadata(DETECTION_PAGE.meta);

export default function DetectionFeaturePage() {
  return <FonctionnaliteTiimePage segment="detection" />;
}
