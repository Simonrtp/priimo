"use client";

import { useEffect, useState } from "react";
import { useBetaModal } from "./BetaModalContext";

// === HEADER ===
// Fully transparent at the top — lets the animated hero background
// bleed through. After 50px of scroll, a subtle blurred backdrop and
// shadow appear to keep the logo + CTA legible over page content.
export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const { open } = useBetaModal();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // The header CTA is the only element that scrolls to the inline form
  // anchor (#beta-form) — every other CTA on the page opens the modal.
  const handleHeaderCta = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const target = document.getElementById("beta-form");
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
    } else {
      open();
    }
  };

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-canvas/80 backdrop-blur-md shadow-sm border-b border-black/5"
          : "bg-transparent"
      }`}
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-8 min-w-0">
        <div className="flex h-14 sm:h-16 items-center justify-between gap-2 min-w-0">
          <a
            href="#top"
            className="font-sans text-2xl sm:text-3xl md:text-4xl leading-none font-bold tracking-tight text-accent-dark shrink-0"
          >
            Priimo
          </a>
          <a
            href="#beta-form"
            onClick={handleHeaderCta}
            className="btn btn-primary text-xs sm:text-sm py-2 px-3 sm:py-2.5 sm:px-5 shrink-0"
          >
            <span className="hidden min-[380px]:inline">Rejoindre la bêta</span>
            <span className="inline min-[380px]:hidden">La bêta</span>
          </a>
        </div>
      </div>
    </header>
  );
}
