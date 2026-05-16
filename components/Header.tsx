"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CALENDLY_URL } from "@/lib/calendly";

// === HEADER ===
// Transparent en haut ; fond flouté après scroll. Connexion = lien texte ;
// CTA = btn-primary (cohérent avec le hero et le reste de la landing).
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
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 min-w-0 sm:h-[4.25rem] sm:px-8">
        <Link
          href="/"
          className="shrink-0 font-sans text-[1.75rem] font-bold leading-none text-accent-dark sm:text-4xl md:text-[2.75rem]"
        >
          Priimo
        </Link>

        <div className="flex shrink-0 items-center gap-5 sm:gap-8">
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
            <span aria-hidden>→</span>
          </a>
        </div>
      </div>
    </header>
  );
}
