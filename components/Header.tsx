"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PriimoWord } from "@/components/brand/PriimoWord";
import { CALENDLY_URL } from "@/lib/calendly";

// === HEADER ===
// Refonte 2.0 : barre flottante en verre (glass) qui se contracte au scroll.
// Logo en dégradé chaud animé ; « Se connecter » = lien texte ; CTA = btn-primary.
export default function Header() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-50 flex justify-center px-3 pt-3 sm:px-5 sm:pt-4">
      <div
        className={`flex w-full max-w-6xl items-center justify-between gap-4 rounded-full px-4 transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] min-w-0 sm:px-6 ${
          scrolled
            ? "h-14 border border-white/70 bg-white/70 shadow-[0_10px_30px_-12px_rgba(60,40,20,0.35)] backdrop-blur-xl sm:h-[3.75rem]"
            : "h-16 border border-transparent bg-transparent sm:h-[4.25rem]"
        }`}
      >
        <Link
          href="/"
          className="group shrink-0 text-[1.5rem] leading-none sm:text-[1.75rem] md:text-[2rem]"
        >
          <PriimoWord className="text-[1.5rem] font-bold sm:text-[1.75rem] md:text-[2rem]">Priimo</PriimoWord>
        </Link>

        <div className="flex shrink-0 items-center gap-4 sm:gap-6">
          <Link
            href="/login"
            className="group relative inline-flex min-h-11 items-center text-[14px] font-medium text-gray-700 transition-colors duration-200 hover:text-accent-dark sm:text-[15px]"
          >
            Se connecter
            <span
              className="absolute -bottom-0.5 left-0 h-px w-0 bg-accent transition-all duration-200 ease-out group-hover:w-full"
              aria-hidden
            />
          </Link>

          <a
            href={CALENDLY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary inline-flex min-h-11 items-center gap-1.5 px-5 py-2.5 text-[14px] sm:px-6 sm:py-3 sm:text-[15px]"
          >
            <span className="sm:hidden">Démo</span>
            <span className="hidden sm:inline">Réserver une démo</span>
            <span data-arrow aria-hidden>
              →
            </span>
          </a>
        </div>
      </div>
    </header>
  );
}
