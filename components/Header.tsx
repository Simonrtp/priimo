"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { PriimoLogo } from "@/components/brand/PriimoLogo";
import ResourcesMenu from "@/components/ResourcesMenu";
import {
  FeaturesMegaPanel,
  FeaturesMenuTrigger,
} from "@/components/FeaturesMenu";
import MobileNav from "@/components/MobileNav";
import CtaButton from "@/components/CtaButton";
import type { BlogPostSummary } from "@/lib/blog/types";

type HeaderProps = {
  latestPost?: BlogPostSummary | null;
  variant?: "default" | "landing";
};

// === HEADER ===
// Landing : bandeau + nav plein écran → pilule verre au scroll (transition fluide).
// Autres pages : barre flottante en verre.
type NavMenu = "features" | "resources" | null;

export default function Header({
  latestPost = null,
  variant = "default",
}: HeaderProps) {
  const [scrolled, setScrolled] = useState(false);
  const [activeNavMenu, setActiveNavMenu] = useState<NavMenu>(null);
  const headerRootRef = useRef<HTMLDivElement>(null);

  const featuresOpen = activeNavMenu === "features";
  const resourcesOpen = activeNavMenu === "resources";
  const featuresPanelId = "features-mega-menu";
  const isLanding = variant === "landing";
  const onDark = isLanding && !scrolled;

  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        const y = window.scrollY;
        // Hystérésis : évite le bascule-bascule autour du seuil.
        setScrolled((prev) => {
          if (!prev && y > 36) return true;
          if (prev && y < 10) return false;
          return prev;
        });
        ticking = false;
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const setFeaturesOpen = (open: boolean) => {
    setActiveNavMenu(open ? "features" : null);
  };

  const setResourcesOpen = (open: boolean) => {
    setActiveNavMenu(open ? "resources" : null);
  };

  if (!isLanding) {
    return (
      <header className="fixed inset-x-0 top-0 z-50 flex justify-center px-3 pt-3 sm:px-5 sm:pt-4">
        <div ref={headerRootRef} className="relative w-full max-w-6xl min-w-0">
          <div
            className={`relative z-10 flex w-full items-center justify-between gap-2 rounded-full px-3 transition-all duration-fluid ease-soft min-w-0 sm:gap-4 sm:px-6 ${
              scrolled
                ? "h-14 border border-white/70 bg-white/70 shadow-[0_10px_30px_-12px_rgba(60,40,20,0.35)] backdrop-blur-xl sm:h-[3.75rem]"
                : "h-16 border border-transparent bg-transparent sm:h-[4.25rem]"
            }`}
          >
            <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-6 lg:gap-8">
              <Link href="/" className="group shrink-0 leading-none">
                <PriimoLogo
                  priority
                  className="h-10 sm:h-11 md:h-12"
                  imageClassName="transition-opacity duration-200 group-hover:opacity-90"
                />
              </Link>
              <nav className="hidden min-w-0 items-center gap-6 lg:flex" aria-label="Navigation principale">
                <FeaturesMenuTrigger
                  open={featuresOpen}
                  onOpenChange={setFeaturesOpen}
                  panelId={featuresPanelId}
                />
                <ResourcesMenu
                  latestPost={latestPost}
                  open={resourcesOpen}
                  onOpenChange={setResourcesOpen}
                />
              </nav>
            </div>
            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2 lg:gap-6">
              <Link
                href="/login"
                className="group relative hidden min-h-11 items-center font-nunito text-[13px] font-bold text-gray-700 transition-colors duration-200 hover:text-accent-dark sm:text-[15px] lg:inline-flex"
              >
                Se connecter
                <span
                  className="absolute -bottom-0.5 left-0 h-px w-0 bg-accent transition-all duration-200 ease-out group-hover:w-full"
                  aria-hidden
                />
              </Link>
              <CtaButton className="min-h-11 px-3.5 py-2.5 text-[13px] sm:px-6 sm:py-3 sm:text-[15px]">
                <span className="sm:hidden">Démo</span>
                <span className="hidden sm:inline">Réserver une démo</span>
              </CtaButton>
              <MobileNav />
            </div>
          </div>
          <FeaturesMegaPanel
            open={featuresOpen}
            onOpenChange={setFeaturesOpen}
            panelId={featuresPanelId}
          />
        </div>
      </header>
    );
  }

  return (
    <header
      className={`landing-site-header fixed inset-x-0 top-0 z-50 transition-[padding] duration-fluid ease-soft ${
        scrolled ? "px-3 pt-3 sm:px-5 sm:pt-4" : "px-0 pt-0"
      }`}
      data-scrolled={scrolled ? "true" : "false"}
    >
      <div
        className={`landing-utility-bar grid transition-[grid-template-rows,opacity] duration-fluid ease-soft ${
          scrolled ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100"
        }`}
        aria-hidden={scrolled}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="landing-utility-inner flex h-9 w-full items-center justify-end gap-5 border-b border-white/[0.08] px-4 pt-[env(safe-area-inset-top)] sm:h-10 sm:px-6 lg:px-8">
            <Link
              href="/login"
              tabIndex={scrolled ? -1 : undefined}
              className="landing-utility-login group inline-flex min-h-9 items-center gap-2 font-nunito text-[13px] font-bold tracking-wide text-white transition-[opacity,transform] duration-fluid ease-soft sm:min-h-10 sm:text-[14px]"
            >
              <span
                className="flex size-6 items-center justify-center rounded-full bg-white/12 ring-1 ring-white/20 transition-colors duration-fluid ease-soft group-hover:bg-white/20"
                aria-hidden
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </span>
              Se connecter
            </Link>
          </div>
        </div>
      </div>

      <div
        className={`mx-auto flex w-full justify-center transition-[padding] duration-fluid ease-soft ${
          scrolled ? "px-0" : "px-4 sm:px-6 lg:px-8"
        }`}
      >
        <div
          ref={headerRootRef}
          className={`relative min-w-0 transition-[max-width] duration-fluid ease-soft ${
            scrolled ? "w-full max-w-6xl" : "w-full max-w-none"
          }`}
        >
          <div
            className={`landing-nav-shell relative z-10 flex w-full items-center justify-between gap-2 min-w-0 sm:gap-4 ${
              scrolled
                ? "h-14 rounded-full border border-white/70 bg-white/70 px-3 shadow-[0_10px_30px_-12px_rgba(60,40,20,0.35)] backdrop-blur-xl sm:h-[3.75rem] sm:px-6"
                : "h-16 rounded-none border border-transparent bg-transparent px-0 sm:h-[4.25rem]"
            }`}
          >
            <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-6 lg:gap-8">
              <Link href="/" className="group shrink-0 leading-none">
                <PriimoLogo
                  priority
                  className="h-10 sm:h-11 md:h-12"
                  imageClassName="transition-opacity duration-fluid ease-soft group-hover:opacity-90"
                />
              </Link>

              <nav className="hidden min-w-0 items-center gap-6 lg:flex" aria-label="Navigation principale">
                <FeaturesMenuTrigger
                  open={featuresOpen}
                  onOpenChange={setFeaturesOpen}
                  panelId={featuresPanelId}
                  onDark={onDark}
                />
                <ResourcesMenu
                  latestPost={latestPost}
                  open={resourcesOpen}
                  onOpenChange={setResourcesOpen}
                  onDark={onDark}
                />
              </nav>
            </div>

            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2 lg:gap-6">
              <Link
                href="/login"
                className={`landing-nav-login group relative hidden min-h-11 items-center font-nunito text-[13px] font-bold text-gray-700 sm:text-[15px] lg:inline-flex ${
                  scrolled
                    ? "pointer-events-auto translate-y-0 opacity-100 hover:text-accent-dark"
                    : "pointer-events-none -translate-y-0.5 opacity-0"
                }`}
                tabIndex={scrolled ? undefined : -1}
                aria-hidden={!scrolled}
              >
                Se connecter
                <span
                  className="absolute -bottom-0.5 left-0 h-px w-0 bg-accent transition-all duration-fluid-subtle ease-soft group-hover:w-full"
                  aria-hidden
                />
              </Link>

              <CtaButton className="min-h-11 px-3.5 py-2.5 text-[13px] sm:px-6 sm:py-3 sm:text-[15px]">
                <span className="sm:hidden">Démo</span>
                <span className="hidden sm:inline">Réserver une démo</span>
              </CtaButton>

              <MobileNav onDark={onDark} />
            </div>
          </div>

          <FeaturesMegaPanel
            open={featuresOpen}
            onOpenChange={setFeaturesOpen}
            panelId={featuresPanelId}
          />
        </div>
      </div>
    </header>
  );
}
