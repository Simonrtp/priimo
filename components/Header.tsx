"use client";

import Link from "next/link";
import { useState } from "react";
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

type NavMenu = "features" | "resources" | null;

/**
 * Header marketing style Tiime : barre navy opaque, texte blanc, CTA orange.
 * Pas de glassmorphism, pas de pilule au scroll.
 */
export default function Header({
  latestPost = null,
  variant = "default",
}: HeaderProps) {
  const [activeNavMenu, setActiveNavMenu] = useState<NavMenu>(null);
  const featuresOpen = activeNavMenu === "features";
  const resourcesOpen = activeNavMenu === "resources";
  const featuresPanelId = "features-mega-menu";

  return (
    <header
      className="landing-site-header fixed inset-x-0 top-0 z-50"
      data-variant={variant}
    >
      <div className="landing-nav-bar">
        <div className="landing-nav-inner relative min-w-0">
          <div className="relative z-10 flex h-[4.25rem] w-full min-w-0 items-center justify-between gap-2 sm:h-[4.5rem] sm:gap-4">
            <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-6 lg:gap-10">
              <Link href="/" className="group shrink-0 leading-none">
                <PriimoLogo
                  priority
                  className="h-9 sm:h-10 md:h-11"
                  imageClassName="transition-opacity duration-200 group-hover:opacity-90"
                />
              </Link>

              <nav
                className="hidden min-w-0 items-center gap-6 lg:flex xl:gap-8"
                aria-label="Navigation principale"
              >
                <FeaturesMenuTrigger
                  open={featuresOpen}
                  onOpenChange={(open) => setActiveNavMenu(open ? "features" : null)}
                  panelId={featuresPanelId}
                  onDark
                />
                <ResourcesMenu
                  latestPost={latestPost}
                  open={resourcesOpen}
                  onOpenChange={(open) => setActiveNavMenu(open ? "resources" : null)}
                  onDark
                />
              </nav>
            </div>

            <div className="flex shrink-0 items-center gap-1.5 sm:gap-3 lg:gap-5">
              <Link
                href="/login"
                className="group relative hidden min-h-11 items-center font-nunito text-[13px] font-bold text-white/90 transition-colors duration-200 hover:text-white sm:text-[15px] lg:inline-flex"
              >
                Se connecter
              </Link>

              <CtaButton className="min-h-11 px-3.5 py-2.5 text-[13px] sm:px-6 sm:py-3 sm:text-[15px]">
                <span className="sm:hidden">Démo</span>
                <span className="hidden sm:inline">Réserver une démo</span>
              </CtaButton>

              <MobileNav onDark />
            </div>
          </div>

          <FeaturesMegaPanel
            open={featuresOpen}
            onOpenChange={(open) => setActiveNavMenu(open ? "features" : null)}
            panelId={featuresPanelId}
          />
        </div>
      </div>
    </header>
  );
}
