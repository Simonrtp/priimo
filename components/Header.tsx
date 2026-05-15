"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

// === HEADER ===
// Fully transparent at the top — lets the animated hero background
// bleed through. After 50px of scroll, a subtle blurred backdrop and
// shadow appear to keep the logo + CTAs legible over page content.
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
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-canvas/80 backdrop-blur-md shadow-sm border-b border-black/5"
          : "bg-transparent"
      }`}
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-8 min-w-0">
        <div className="flex h-14 sm:h-16 items-center justify-between gap-2 min-w-0">
          <Link
            href="/"
            className="font-sans text-2xl sm:text-3xl md:text-4xl leading-none font-bold tracking-tight text-accent-dark shrink-0"
          >
            Priimo
          </Link>

          <nav className="flex items-center gap-2 sm:gap-4 shrink-0">
            <Link
              href="/login"
              className="text-sm font-medium text-gray-700 hover:text-accent-dark transition px-2 sm:px-3 py-2"
            >
              Se connecter
            </Link>
            <Link
              href="/signup"
              className="btn btn-primary text-xs sm:text-sm py-2 px-3 sm:py-2.5 sm:px-5"
            >
              Créer un compte
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
