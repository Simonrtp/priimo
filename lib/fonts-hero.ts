import { Montserrat } from "next/font/google";

/** Titres landing (hero + petits titres) — Montserrat. */
export const fontHero = Montserrat({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  display: "swap",
  variable: "--font-hero",
});
