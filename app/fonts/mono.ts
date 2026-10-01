import localFont from "next/font/local";

/**
 * JetBrains Mono hébergé ici — pas de fetch Google au build.
 * Turbopack Vercel cassait sur next/font/google pour cette famille.
 */
export const fontMono = localFont({
  src: [
    {
      path: "./jetbrains-mono-latin-400-normal.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "./jetbrains-mono-latin-500-normal.woff2",
      weight: "500",
      style: "normal",
    },
  ],
  variable: "--font-mono",
  display: "swap",
  fallback: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
});
