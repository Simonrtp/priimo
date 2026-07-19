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
import { CALENDLY_URL } from "@/lib/calendly";
import type { BlogPostSummary } from "@/lib/blog/types";

type HeaderProps = {
  latestPost?: BlogPostSummary | null;
};

// === HEADER ===
// Barre flottante en verre (glass) qui se contracte au scroll.
// Desktop : méga-menu au hover. Mobile : hamburger + panneau latéral.
type NavMenu = "features" | "resources" | null;

export default function Header({ latestPost = null }: HeaderProps) {
  const [scrolled, setScrolled] = useState(false);
  const [activeNavMenu, setActiveNavMenu] = useState<NavMenu>(null);
  const headerRootRef = useRef<HTMLDivElement>(null);

  const featuresOpen = activeNavMenu === "features";
  const resourcesOpen = activeNavMenu === "resources";
  const featuresPanelId = "features-mega-menu";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
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

  return (
    <header className="fixed inset-x-0 top-0 z-50 flex justify-center px-3 pt-3 sm:px-5 sm:pt-4">
      <div ref={headerRootRef} className="relative w-full max-w-6xl min-w-0">
        <div
          className={`relative z-10 flex w-full items-center justify-between gap-2 rounded-full px-3 transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] min-w-0 sm:gap-4 sm:px-6 ${
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
              className="group relative hidden min-h-11 items-center text-[13px] font-medium text-gray-700 transition-colors duration-200 hover:text-accent-dark sm:text-[15px] lg:inline-flex"
            >
              Se connecter
              <span
                className="absolute -bottom-0.5 left-0 h-px w-0 bg-accent transition-all duration-200 ease-out group-hover:w-full"
                aria-hidden
              />
            </Link>

            <MobileNav />

            <a
              href={CALENDLY_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary inline-flex min-h-11 items-center gap-1.5 px-3.5 py-2.5 text-[13px] sm:px-6 sm:py-3 sm:text-[15px]"
            >
              <span className="sm:hidden">Démo</span>
              <span className="hidden sm:inline">Réserver une démo</span>
              <span data-arrow aria-hidden>
                →
              </span>
            </a>
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
