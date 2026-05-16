"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

// === HEADER ===
// Totalement transparent en haut — laisse le fond animé du hero respirer.
// Après 50px de scroll, un fond flouté et une légère ombre apparaissent
// pour garder logo + lien de connexion lisibles sur le contenu.
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

          <Link
            href="/login"
            className="inline-flex items-center rounded-full border border-black/10 bg-white/60 px-4 py-2 text-sm font-medium text-gray-900 backdrop-blur-sm transition hover:bg-white hover:border-black/20"
          >
            Se connecter
          </Link>
        </div>
      </div>
    </header>
  );
}
