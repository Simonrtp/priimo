import CausioScripts from "@/components/landing/CausioScripts";
import SiteHeader from "@/components/SiteHeader";
import HeroSection from "@/components/HeroSection";
import AgencyLogos from "@/components/AgencyLogos";
import WhyPriimo from "@/components/WhyPriimo";
import OffresSimplesIntro from "@/components/OffresSimplesIntro";
import FAQ from "@/components/FAQ";
import LandingAmbianceBand from "@/components/LandingAmbianceBand";
import Footer from "@/components/Footer";
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
       * déclarent leur propre fond (Hero, Footer)
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

        {/* Why + prix + FAQ : même ambiance, en même temps */}
        <LandingAmbianceBand>
          <WhyPriimo />
          <OffresSimplesIntro />
          <FAQ />
        </LandingAmbianceBand>

        {/* Footer seul : photo Lyon + colonnes de liens (sans bloc CTA secteur exclusif). */}
        <div className="mt-12 sm:mt-16">
          <Footer className="rounded-t-[28px] sm:rounded-t-[40px]" />
        </div>
      </main>
    </div>
  );
}
