import localFont from "next/font/local";

/**
 * Textes et boutons landing — Nunito latin.
 * Hébergé ici pour le même motif que Montserrat : pas de fetch Google au build.
 */
export const fontNunito = localFont({
  src: [
    {
      path: "../app/fonts/nunito-latin-400-normal.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../app/fonts/nunito-latin-500-normal.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../app/fonts/nunito-latin-600-normal.woff2",
      weight: "600",
      style: "normal",
    },
    {
      path: "../app/fonts/nunito-latin-700-normal.woff2",
      weight: "700",
      style: "normal",
    },
    {
      path: "../app/fonts/nunito-latin-800-normal.woff2",
      weight: "800",
      style: "normal",
    },
  ],
  display: "swap",
  variable: "--font-nunito",
});
