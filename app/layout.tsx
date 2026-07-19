import type { Metadata, Viewport } from "next";
import { Inter, Plus_Jakarta_Sans, JetBrains_Mono, Libre_Baskerville } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { Toaster } from "sonner";
import CausioRouteGuard from "@/components/landing/CausioRouteGuard";
import "./globals.css";

// === FONTS (next/font — self-hosted, aucun <link> externe) ===
// Corps & données : Inter → --font-sans / --font-body (PRIIMO_DESIGN_SYSTEM.md §2.1)
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

// Display (titres, valeurs KPI héro) : Plus Jakarta Sans → --font-display (option B)
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

// Marque (logo « Priimo ») : Libre Baskerville → --font-brand
const libreBaskerville = Libre_Baskerville({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-brand",
  display: "swap",
});

// Chiffres techniques / IDs : JetBrains Mono → --font-mono
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

// Public site URL — falls back to the Vercel-injected URL when previewing,
// then to localhost for local development. Used to build absolute OG/canonical
// URLs.
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

// === SEO ===
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Priimo — Logiciel de prospection immobilière prédictive",
    template: "%s · Priimo",
  },
  description:
    "Le logiciel de prospection prédictive des agences immobilières : signaux DVF, DPE, BODACC et copropriétés croisés, liste hebdomadaire d'adresses scorées, secteur exclusif, module SCI.",
  applicationName: "Priimo",
  keywords: [
    "prospection immobilière",
    "mandats vendeurs",
    "DVF",
    "DPE",
    "logiciel immobilier",
    "agence immobilière",
    "prédictif",
    "signaux de vie",
    "événements de vie",
    "prospection vendeurs",
    "SCI",
    "secteur exclusif",
  ],
  authors: [{ name: "Priimo" }],
  creator: "Priimo",
  robots: { index: true, follow: true },
  alternates: { canonical: "/" },
  openGraph: {
    title: "Priimo — Prospection immobilière prédictive",
    description:
      "Événements de vie et signaux de marché, livrés chaque semaine sur votre secteur exclusif.",
    url: "/",
    siteName: "Priimo",
    locale: "fr_FR",
    type: "website",
    images: [{ url: "/logoprii.png", alt: "Priimo" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Priimo — Prospection immobilière prédictive",
    description:
      "Événements de vie et signaux de marché, livrés chaque semaine sur votre secteur exclusif.",
    images: ["/logoprii.png"],
  },
  icons: {
    icon: [
      { url: "/icon-48.png", type: "image/png", sizes: "48x48" },
      { url: "/favicon-32x32.png", type: "image/png", sizes: "32x32" },
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
    ],
    apple: [{ url: "/apple-touch-icon.png", type: "image/png", sizes: "180x180" }],
    shortcut: "/favicon.ico",
  },
  manifest: "/site.webmanifest",
  formatDetection: { telephone: false, address: false, email: false },
};

export const viewport: Viewport = {
  themeColor: "#E8743C",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="fr"
      className={`${inter.variable} ${jakarta.variable} ${jetbrainsMono.variable} ${libreBaskerville.variable}`}
    >
      <body className="font-sans bg-white text-gray-700 antialiased overflow-x-clip min-w-0">
        <CausioRouteGuard />
        {children}
        <Toaster richColors position="top-right" />
        <Analytics />
      </body>
    </html>
  );
}
