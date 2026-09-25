import { Nunito } from "next/font/google";

/** Typo des boutons (CTA, actions) — Nunito. */
export const fontNunito = Nunito({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  display: "swap",
  variable: "--font-nunito",
});
