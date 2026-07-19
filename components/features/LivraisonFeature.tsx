import SiteHeader from '@/components/SiteHeader';
import FinalCTA from '@/components/FinalCTA';
import { LIVRAISON_PAGE, getSection } from '@/lib/features/pages';

import FeatureHero from './blocks/FeatureHero';
import Band from './blocks/Band';
import FeatureSplit from './blocks/FeatureSplit';
import StepFlow from './blocks/StepFlow';
import LeadCardMock from './blocks/LeadCardMock';
import SecteurMap from './blocks/SecteurMap';
import StatusChips from './blocks/StatusChips';
import ExportCard from './blocks/ExportCard';
import Statement from './blocks/Statement';

// === PAGE FONCTIONNALITÉS · LIVRAISON ===
// Refonte visuelle : mêmes textes, mise en scène dense et rythmée.

export default function LivraisonFeature() {
  const liste = getSection(LIVRAISON_PAGE, 'liste');
  const secteur = getSection(LIVRAISON_PAGE, 'secteur');
  const suivi = getSection(LIVRAISON_PAGE, 'suivi');
  const feedback = getSection(LIVRAISON_PAGE, 'feedback');
  const exportSection = getSection(LIVRAISON_PAGE, 'export');

  return (
    <>
      <SiteHeader />
      <main className="feature-page min-w-0 overflow-x-clip">
        <FeatureHero
          label={LIVRAISON_PAGE.label}
          h1={LIVRAISON_PAGE.h1}
          accroche={LIVRAISON_PAGE.accroche}
          media={
            <video
              src="/priimo-liste.mp4"
              autoPlay
              loop
              muted
              playsInline
              preload="auto"
              className="block w-full rounded-[20px]"
              aria-hidden
            />
          }
        />

        {/* 2 — Le parcours en 3 temps */}
        <Band tone="white" space="tight">
          <StepFlow />
        </Band>

        {/* 3 — La liste du lundi (texte / carte de lead) */}
        <Band tone="cream">
          <FeatureSplit
            title={liste.title}
            paragraphs={liste.paragraphs}
            visual={<LeadCardMock />}
          />
        </Band>

        {/* 4 — Votre secteur (carte quartier / texte) */}
        <Band tone="white">
          <FeatureSplit
            reversed
            id={secteur.id}
            title={secteur.title}
            paragraphs={secteur.paragraphs}
            visual={<SecteurMap />}
          />
        </Band>

        {/* 5 — Travailler à plusieurs (texte / statuts) */}
        <Band tone="cream">
          <FeatureSplit
            id={suivi.id}
            title={suivi.title}
            paragraphs={suivi.paragraphs}
            visual={<StatusChips only="statuts" />}
          />
        </Band>

        {/* 6 — Boucle de feedback (résultats / texte) */}
        <Band tone="white">
          <FeatureSplit
            reversed
            title={feedback.title}
            paragraphs={feedback.paragraphs}
            visual={<StatusChips only="resultats" />}
          />
        </Band>

        {/* 7 — Sur le terrain (texte / export) */}
        <Band tone="cream">
          <FeatureSplit
            id={exportSection.id}
            title={exportSection.title}
            paragraphs={exportSection.paragraphs}
            visual={<ExportCard />}
          />
        </Band>

        {/* 8 — Manifeste */}
        <Statement text={LIVRAISON_PAGE.enClair} />
      </main>
      <FinalCTA />
    </>
  );
}
