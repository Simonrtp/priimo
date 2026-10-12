import FonctionnaliteTiimePage from "@/components/features/FonctionnaliteTiimePage";
import { TERRAIN_PAGE } from "@/lib/features/pages";
import { featurePageMetadata } from "@/lib/features/seo";

export const metadata = featurePageMetadata(TERRAIN_PAGE.meta);

export default function TerrainFeaturePage() {
  return <FonctionnaliteTiimePage segment="terrain" />;
}
