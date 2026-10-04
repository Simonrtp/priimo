"use client";

import Reveal from "./Reveal";
import CtaButton from "./CtaButton";
import FaqAccordion from "./faq/FaqAccordion";
import CapsuleGlyph from "@/components/landing/CapsuleGlyph";
import { FAQ_HOME } from "@/lib/landing/faq";

export default function FAQ({ className = "" }: { className?: string }) {
  return (
    <section
      id="faq"
      className={`faq-landing py-10 sm:py-16 ${className}`}
      aria-labelledby="faq-home-title"
    >
      <Reveal direction="up" className="px-4 sm:px-8">
        <h2 id="faq-home-title" className="faq-landing-title">
          <span className="faq-landing-lead">Plus de questions sur notre</span>
          <span className="faq-landing-capsule">
            <CapsuleGlyph kind="chat" className="faq-landing-capsule-icon" />
            logiciel
          </span>
        </h2>
      </Reveal>

      <div className="mx-auto mt-8 max-w-6xl px-4 sm:mt-10 sm:px-8 min-w-0">
        <FaqAccordion items={FAQ_HOME} idPrefix="home-faq" />

        <Reveal
          direction="scale"
          delay={200}
          className="mt-8 flex justify-center overflow-visible"
        >
          <CtaButton href="/faq">
            En savoir plus
            <span data-arrow aria-hidden>
              →
            </span>
          </CtaButton>
        </Reveal>
      </div>
    </section>
  );
}
