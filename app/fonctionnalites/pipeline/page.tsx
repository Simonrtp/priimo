import FonctionnaliteTiimePage from "@/components/features/FonctionnaliteTiimePage";
import { PIPELINE_PAGE } from "@/lib/features/pages";
import { featurePageMetadata } from "@/lib/features/seo";

export const metadata = featurePageMetadata(PIPELINE_PAGE.meta);

export default function PipelineFeaturePage() {
  return <FonctionnaliteTiimePage segment="pipeline" />;
}
