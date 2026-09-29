import CausioScripts from "@/components/landing/CausioScripts";
import SiteHeader from "@/components/SiteHeader";
import HeroSection from "@/components/HeroSection";
import AgencyLogos from "@/components/AgencyLogos";
import ProblemTransformation from "@/components/ProblemTransformation";
import WhyPriimo from "@/components/WhyPriimo";
import OffresSimplesIntro from "@/components/OffresSimplesIntro";
import LandingAmbianceBand from "@/components/LandingAmbianceBand";
import HowItWorks from "@/components/HowItWorks";
import Features from "@/components/Features";
import DataReassurance from "@/components/DataReassurance";
import FAQ from "@/components/FAQ";
import FinalCTA from "@/components/FinalCTA";
import ScrollLine from "@/components/ScrollLine";

// === LANDING PAGE ===
// Objectif unique : convertir vers la réservation de démo (Calendly).
// Refonte visuelle 2.0 — tout est scopé sous `.landing` (voir globals.css) ;
// le dashboard, le login et les pages légales ne sont pas affectés.
export default function Page() {
  return (
    <div className="landing">
      <ScrollLine />
      <CausioScripts />

      {/*
       * Fond de scène : nappes d'aurore floues qui dérivent lentement,
       * posées derrière chaque section (transparent). Les sections qui
       * déclarent leur propre fond (Hero, ProblemTransformation, FinalCTA)
       * le recouvrent naturellement. Grain + dégradés chauds : gérés en CSS
       * sur `.landing` et `.landing-aurora`.
       */}
      <div aria-hidden className="landing-aurora">
        <span />
        <span />
        <span />
      </div>

      {/* === A — HEADER === */}
      <SiteHeader variant="landing" />

      <main className="relative z-10 min-w-0 overflow-x-clip">
        {/* === B — HERO === */}
        <HeroSection />

        {/* === B2 — AGENCES (preuve sociale) === */}
        <AgencyLogos />

        {/* Why + prix + section suivante : même ambiance, en même temps */}
        <LandingAmbianceBand>
          <WhyPriimo />
          <OffresSimplesIntro />
          <ProblemTransformation />
        </LandingAmbianceBand>

        {/* === D — HOW IT WORKS === */}
        <HowItWorks />

        {/* === E — FEATURES === */}
        <Features />

        {/* === G — DATA REASSURANCE === */}
        <DataReassurance />

        {/* === I — FAQ === */}
        <FAQ />

        {/* === J — FINAL CTA === */}
        <FinalCTA />
      </main>
    </div>
  );
}
