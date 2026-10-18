import localFont from "next/font/local";

/**
 * Titres landing (hero + petits titres) — Montserrat latin 600/700/800.
 * Fichiers hébergés ici : le build Vercel ne doit plus dépendre de Google Fonts.
 * Turbopack casse quand Google répond avec une URL /l/font?kit=…&skey=…
 */
export const fontHero = localFont({
  src: [
    {
      path: "../app/fonts/montserrat-latin-600-normal.woff2",
      weight: "600",
      style: "normal",
    },
    {
      path: "../app/fonts/montserrat-latin-700-normal.woff2",
      weight: "700",
      style: "normal",
    },
    {
      path: "../app/fonts/montserrat-latin-800-normal.woff2",
      weight: "800",
      style: "normal",
    },
  ],
  display: "swap",
  variable: "--font-hero",
});
