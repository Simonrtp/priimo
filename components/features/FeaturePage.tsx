import SiteHeader from '@/components/SiteHeader';
import Footer from '@/components/Footer';
import Band from '@/components/features/blocks/Band';
import FeatureHero from '@/components/features/blocks/FeatureHero';
import FeatureSplit from '@/components/features/blocks/FeatureSplit';
import ProductShot from '@/components/features/blocks/ProductShot';
import ProofBlock from '@/components/features/blocks/ProofBlock';
import RelatedPages from '@/components/features/blocks/RelatedPages';
import FeatureCta from '@/components/features/blocks/FeatureCta';
import type { FeaturePageContent } from '@/lib/features/pages';

export default function FeaturePage({ page }: { page: FeaturePageContent }) {
  return (
    <>
      <SiteHeader />
      <main className="feature-page min-w-0 overflow-x-clip">
        <FeatureHero label={page.label} h1={page.h1} mecanisme={page.mecanisme} />

        {page.benefits.map((benefit, index) => (
          <Band key={benefit.title} tone={index % 2 === 0 ? 'white' : 'cream'}>
            <FeatureSplit
              reversed={index % 2 === 1}
              title={benefit.title}
              paragraphs={[benefit.body]}
              visual={<ProductShot {...benefit.capture} />}
            />
          </Band>
        ))}

        <ProofBlock intro={page.proofIntro} items={page.proof} />
        <RelatedPages pages={page.related} />
        <FeatureCta />
      </main>
      <Footer />
    </>
  );
}
