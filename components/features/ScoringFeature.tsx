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
import ContactsPreview from './blocks/ContactsPreview';
import { Building2, Store } from 'lucide-react';

// === PAGE FONCTIONNALITÉS · SCORING ===
// Refonte visuelle : mêmes textes, mise en scène dense et rythmée.

export default function ScoringFeature() {
  const contacts = getSection(SCORING_PAGE, 'contacts');
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

        {/* 2 — Contacts (propriétaire / voisins) — placé haut */}
        <Band tone="white">
          <FeatureSplit
            id="contacts"
            title={contacts.title}
            paragraphs={contacts.paragraphs}
            bullets={[
              {
                Icon: Building2,
                text: 'Propriétaire en société : numéro professionnel du dirigeant, quand il est identifiable.',
              },
              {
                Icon: Store,
                text: 'Sinon : contacts pros des voisins de l’immeuble — pour le terrain et le réseau local.',
              },
            ]}
            visual={<ContactsPreview />}
          />
        </Band>

        {/* 3 — Le signal (texte / carte de lead) */}
        <Band tone="cream">
          <FeatureSplit
            title={signal.title}
            paragraphs={signal.paragraphs}
            visual={<LeadCardMock />}
          />
        </Band>

        {/* 4 — Bases de données croisées */}
        <Band tone="white">
          <SectionHead
            id={sources.id}
            title={sources.title}
            paragraphs={sources.paragraphs}
          />
          <SourceGrid />
        </Band>

        {/* 5 — Un score de 0 à 100 (breakdown / texte) */}
        <Band tone="cream">
          <FeatureSplit
            reversed
            title={score.title}
            paragraphs={score.paragraphs}
            visual={<ScoreBreakdown />}
          />
        </Band>

        {/* 6 — Le pourquoi, toujours affiché (texte / gros plan signaux) */}
        <Band tone="white">
          <FeatureSplit
            id={pourquoi.id}
            title={pourquoi.title}
            paragraphs={pourquoi.paragraphs}
            visual={<SignauxCard />}
          />
        </Band>

        {/* 7 — Vérification marché (après le scoring) */}
        <Band tone="cream" id={verification.id}>
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
          <div className="mx-auto mt-8 max-w-[680px] rounded-2xl border border-[#3D5A80]/25 bg-white px-5 py-4 sm:mt-10 sm:px-6 sm:py-5">
            <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[#3D5A80]">
              {verificationDisclaimer.title}
            </p>
            <p className="mt-2 text-[15px] leading-relaxed text-gray-700 sm:text-base">
              {verificationDisclaimer.paragraphs[0]}
            </p>
          </div>
        </Band>

        {/* 8 — Manifeste */}
        <Statement text={SCORING_PAGE.enClair} />
      </main>
      <FinalCTA />
    </>
  );
}
