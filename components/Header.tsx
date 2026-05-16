"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CALENDLY_URL } from "@/lib/calendly";

// === HEADER ===
// Transparent en haut ; fond flouté après scroll. Actions regroupées en un
// seul bloc pill (connexion + démo) pour une hiérarchie visuelle claire.
export default function Header() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-[background-color,box-shadow,border-color] duration-300 ${
        scrolled
          ? "border-b border-black/[0.06] bg-canvas/85 shadow-[0_1px_0_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.04)] backdrop-blur-md"
          : "border-b border-transparent bg-transparent"
      }`}
    >
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 min-w-0 sm:h-16 sm:px-8">
        <Link
          href="/"
          className="shrink-0 font-sans text-[1.35rem] font-bold leading-none tracking-tight text-accent-dark sm:text-[1.65rem] md:text-[1.85rem]"
        >
          Priimo
        </Link>

        <nav
          className="inline-flex shrink-0 items-center rounded-full border border-black/[0.07] bg-white/80 p-1 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_16px_rgba(0,0,0,0.06)] backdrop-blur-md"
          aria-label="Actions du compte"
        >
          <Link
            href="/login"
            className="inline-flex min-h-9 items-center rounded-full px-3.5 text-[13px] font-medium text-gray-600 transition-colors hover:bg-black/[0.04] hover:text-gray-900 sm:px-4"
          >
            Se connecter
          </Link>

          <span className="mx-0.5 hidden h-4 w-px bg-black/10 sm:block" aria-hidden />

          <a
            href={CALENDLY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-9 items-center gap-1 rounded-full bg-accent px-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#C25E2C] sm:px-4"
          >
            <span className="sm:hidden">Démo</span>
            <span className="hidden sm:inline">Réserver une démo</span>
            <span className="hidden text-white/90 sm:inline" aria-hidden>
              →
            </span>
          </a>
        </nav>
      </div>
    </header>
  );
}
