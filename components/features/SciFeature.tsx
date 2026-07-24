import SiteHeader from '@/components/SiteHeader';
import FinalCTA from '@/components/FinalCTA';
import { SCI_PAGE, getSection } from '@/lib/features/pages';

import FeatureHero from './blocks/FeatureHero';
import Band from './blocks/Band';
import SectionHead from './blocks/SectionHead';
import FeatureSplit from './blocks/FeatureSplit';
import SciCardMock from './blocks/SciCardMock';
import ComparatifBlock from './blocks/ComparatifBlock';
import RarityStrip from './blocks/RarityStrip';
import Statement from './blocks/Statement';

// === PAGE FONCTIONNALITÉS · SCI ===
// Refonte visuelle : mêmes textes, mise en scène dense et rythmée.

export default function SciFeature() {
  const dissolution = getSection(SCI_PAGE, 'dissolution');
  const contact = getSection(SCI_PAGE, 'contact');
  const rare = getSection(SCI_PAGE, 'rare');
  const cadre = getSection(SCI_PAGE, 'cadre');

  return (
    <>
      <SiteHeader />
      <main className="feature-page min-w-0 overflow-x-clip">
        <FeatureHero
          label={SCI_PAGE.label}
          h1={SCI_PAGE.h1}
          accroche={SCI_PAGE.accroche}
        />

        {/* 2 — Une dissolution (texte / carte SCI) */}
        <Band tone="white">
          <FeatureSplit
            title={dissolution.title}
            paragraphs={dissolution.paragraphs}
            visual={<SciCardMock />}
          />
        </Band>

        {/* 3 — Le seul lead avec un contact (comparatif) */}
        <Band tone="cream">
          <SectionHead title={contact.title} paragraphs={contact.paragraphs} />
          <ComparatifBlock />
        </Band>

        {/* 4 — Manifeste */}
        <Statement text={SCI_PAGE.enClair} />

        {/* 5 — Un signal rare (texte / cadence) */}
        <Band tone="white">
          <FeatureSplit
            reversed
            title={rare.title}
            paragraphs={rare.paragraphs}
            visual={<RarityStrip />}
          />
        </Band>

        {/* 6 — Cadre de l'échange */}
        <Band tone="cream" space="tight">
          <div className="mx-auto max-w-[680px] rounded-2xl border border-[#3D5A80]/25 bg-white px-5 py-4 sm:px-6 sm:py-5">
            <p className="text-[15px] leading-relaxed text-gray-700 sm:text-base">
              {cadre.paragraphs[0]}
            </p>
          </div>
        </Band>
      </main>
      <FinalCTA />
    </>
  );
}
