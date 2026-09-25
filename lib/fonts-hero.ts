import { Montserrat } from "next/font/google";

/** Titre hero landing uniquement — Montserrat ExtraBold (réf. typo). */
export const fontHero = Montserrat({
  subsets: ["latin"],
  weight: ["800"],
  display: "swap",
  variable: "--font-hero",
});
