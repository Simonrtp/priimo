import CausioScripts from "@/components/landing/CausioScripts";
import Header from "@/components/Header";
import HeroSection from "@/components/HeroSection";
import ProblemTransformation from "@/components/ProblemTransformation";
import HowItWorks from "@/components/HowItWorks";
import Features from "@/components/Features";
import DataReassurance from "@/components/DataReassurance";
import FAQ from "@/components/FAQ";
import FinalCTA from "@/components/FinalCTA";

// === LANDING PAGE ===
// Single goal: drive beta sign-ups. Section order matches the spec exactly.
export default function Page() {
  return (
    <>
      <CausioScripts />
      {/*
       * Ambient orange wash — extremely subtle, static (no mouse, no animation).
       * Two large radial gradients placed off-axis so the eye perceives a soft
       * peachy glow rather than a uniform tint. Sits behind every section with
       * a transparent background; sections that declare their own background
       * (Hero, ProblemTransformation, FinalCTA) cover it naturally.
       */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background: [
            "radial-gradient(900px 700px at 18% 22%, rgba(232, 116, 60, 0.07), transparent 65%)",
            "radial-gradient(820px 620px at 84% 70%, rgba(232, 116, 60, 0.055), transparent 65%)",
            "radial-gradient(700px 520px at 50% 110%, rgba(232, 116, 60, 0.04), transparent 70%)",
          ].join(", "),
        }}
      />

      {/* === A — HEADER === */}
      <Header />

      <main className="relative min-w-0 overflow-x-clip">
        {/* === B — HERO === */}
        <HeroSection />

        {/* === C — PROBLEM / TRANSFORMATION === */}
        <ProblemTransformation />

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
    </>
  );
}
