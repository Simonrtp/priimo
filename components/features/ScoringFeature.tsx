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
  const verification = getSection(SCORING_PAGE, 'verification');
  const verificationComment = getSection(SCORING_PAGE, 'verification-comment');
  const verificationDisclaimer = getSection(SCORING_PAGE, 'verification-disclaimer');

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

        {/* 3 — Bases de données croisées */}
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

        {/* 6 — Vérification marché (après le scoring) */}
        <Band tone="white" id={verification.id}>
          <SectionHead
            title={verification.title}
            paragraphs={verification.paragraphs}
          />
          <div className="mx-auto mt-10 max-w-[680px] sm:mt-12">
            <h3 className="blog-prose-h2 !mt-0 !text-[1.35rem] sm:!text-[1.5rem]">
              {verificationComment.title}
            </h3>
            <p className="blog-prose-p text-pretty">
              {verificationComment.paragraphs[0]}
            </p>
          </div>
          <div className="mx-auto mt-8 max-w-[680px] rounded-2xl border border-[#3D5A80]/25 bg-[#FFF7F0] px-5 py-4 sm:mt-10 sm:px-6 sm:py-5">
            <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[#3D5A80]">
              {verificationDisclaimer.title}
            </p>
            <p className="mt-2 text-[15px] leading-relaxed text-gray-700 sm:text-base">
              {verificationDisclaimer.paragraphs[0]}
            </p>
          </div>
        </Band>

        {/* 7 — Manifeste */}
        <Statement text={SCORING_PAGE.enClair} />
      </main>
      <FinalCTA />
    </>
  );
}
