import localFont from "next/font/local";

/**
 * Corps, titres dashboard et marque.
 * Les woff2 latin sont dans ce dossier : le build ne télécharge plus Google Fonts.
 */

export const fontSans = localFont({
  src: [
    { path: "./inter-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./inter-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./inter-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "./inter-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  display: "swap",
  variable: "--font-sans",
});

export const fontDisplay = localFont({
  src: [
    {
      path: "./plus-jakarta-sans-latin-500-normal.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "./plus-jakarta-sans-latin-600-normal.woff2",
      weight: "600",
      style: "normal",
    },
    {
      path: "./plus-jakarta-sans-latin-700-normal.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  display: "swap",
  variable: "--font-display",
});

export const fontBrand = localFont({
  src: [
    {
      path: "./libre-baskerville-latin-400-normal.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "./libre-baskerville-latin-400-italic.woff2",
      weight: "400",
      style: "italic",
    },
    {
      path: "./libre-baskerville-latin-700-normal.woff2",
      weight: "700",
      style: "normal",
    },
    {
      path: "./libre-baskerville-latin-700-italic.woff2",
      weight: "700",
      style: "italic",
    },
  ],
  display: "swap",
  variable: "--font-brand",
});
