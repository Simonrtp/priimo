import SiteHeader from '@/components/SiteHeader';
import FinalCTA from '@/components/FinalCTA';
import { SCORING_PAGE, getSection } from '@/lib/features/pages';

import FeatureHero from './blocks/FeatureHero';
import Band from './blocks/Band';
import SectionHead from './blocks/SectionHead';
import FeatureSplit from './blocks/FeatureSplit';
import LeadCardMock, { SignauxCard } from './blocks/LeadCardMock';
import SourceGrid from './blocks/SourceGrid';
import ScoreBreakdown from './blocks/ScoreBreakdown';
import Statement from './blocks/Statement';

// === PAGE FONCTIONNALITÉS · SCORING ===
// Refonte visuelle : mêmes textes, mise en scène dense et rythmée.

export default function ScoringFeature() {
  const signal = getSection(SCORING_PAGE, 'signal');
  const sources = getSection(SCORING_PAGE, 'sources');
  const score = getSection(SCORING_PAGE, 'score');
  const pourquoi = getSection(SCORING_PAGE, 'pourquoi');

  return (
    <>
      <SiteHeader />
      <main className="feature-page min-w-0 overflow-x-clip">
        <FeatureHero
          label={SCORING_PAGE.label}
          h1={SCORING_PAGE.h1}
          accroche={SCORING_PAGE.accroche}
        />

        {/* 2 — Le signal (texte / carte de lead) */}
        <Band tone="white">
          <FeatureSplit
            title={signal.title}
            paragraphs={signal.paragraphs}
            visual={<LeadCardMock />}
          />
        </Band>

        {/* 3 — Cinq bases publiques croisées */}
        <Band tone="cream">
          <SectionHead
            id={sources.id}
            title={sources.title}
            paragraphs={sources.paragraphs}
          />
          <SourceGrid />
        </Band>

        {/* 4 — Un score de 0 à 100 (breakdown / texte) */}
        <Band tone="white">
          <FeatureSplit
            reversed
            title={score.title}
            paragraphs={score.paragraphs}
            visual={<ScoreBreakdown />}
          />
        </Band>

        {/* 5 — Le pourquoi, toujours affiché (texte / gros plan signaux) */}
        <Band tone="cream">
          <FeatureSplit
            id={pourquoi.id}
            title={pourquoi.title}
            paragraphs={pourquoi.paragraphs}
            visual={<SignauxCard />}
          />
        </Band>

        {/* 6 — Manifeste */}
        <Statement text={SCORING_PAGE.enClair} />
      </main>
      <FinalCTA />
    </>
  );
}
