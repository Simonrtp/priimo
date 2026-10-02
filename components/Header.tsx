"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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
 * Header marketing : sur la landing, transparent au-dessus du hero
 * puis navy au scroll ; ailleurs, barre opaque d’emblée.
 */
export default function Header({
  latestPost = null,
  variant = "default",
}: HeaderProps) {
  const [activeNavMenu, setActiveNavMenu] = useState<NavMenu>(null);
  const [scrolled, setScrolled] = useState(false);
  const featuresOpen = activeNavMenu === "features";
  const resourcesOpen = activeNavMenu === "resources";
  const featuresPanelId = "features-mega-menu";
  const menuOpen = activeNavMenu != null;
  /** Fond coloré dès qu’on quitte le haut, ou qu’un menu est ouvert. */
  const solid = variant !== "landing" || scrolled || menuOpen;

  useEffect(() => {
    if (variant !== "landing") {
      setScrolled(true);
      return;
    }
    let ticking = false;
    let clearTimer: number | null = null;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        const y = window.scrollY;
        if (y > 20) {
          if (clearTimer != null) {
            window.clearTimeout(clearTimer);
            clearTimer = null;
          }
          setScrolled(true);
        } else if (y <= 12) {
          // Le bleu reste un instant après le retour vers le haut.
          if (clearTimer == null) {
            clearTimer = window.setTimeout(() => {
              clearTimer = null;
              if (window.scrollY <= 12) setScrolled(false);
            }, 520);
          }
        }
        ticking = false;
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (clearTimer != null) window.clearTimeout(clearTimer);
    };
  }, [variant]);

  return (
    <header
      className="landing-site-header fixed inset-x-0 top-0 z-50"
      data-variant={variant}
      data-scrolled={solid ? "true" : "false"}
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
                className="landing-nav-login group relative hidden min-h-11 items-center font-nunito text-[13px] font-bold text-white/90 transition-colors duration-200 hover:text-white sm:text-[15px] lg:inline-flex"
              >
                Se connecter
                <span
                  className="absolute -bottom-0.5 left-0 h-px w-0 bg-accent transition-all duration-200 ease-out group-hover:w-full"
                  aria-hidden
                />
              </Link>

              <CtaButton className="landing-nav-cta min-h-11 px-3.5 py-2.5 text-[13px] sm:px-6 sm:py-3 sm:text-[15px]">
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
