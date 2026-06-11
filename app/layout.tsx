import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

// === FONT: Inter only (400–700) ===
// next/font self-hosts glyphs — preconnect still helps first paint when
// subsets are fetched from Google during build; included for spec compliance.
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
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
      "Événements de vie et signaux publics, livrés chaque semaine sur votre secteur exclusif.",
    url: "/",
    siteName: "Priimo",
    locale: "fr_FR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Priimo — Prospection immobilière prédictive",
    description:
      "Événements de vie et signaux publics, livrés chaque semaine sur votre secteur exclusif.",
  },
  icons: {
    icon: [{ url: "/Logo.png", type: "image/png" }],
    apple: [{ url: "/Logo.png", type: "image/png" }],
    shortcut: "/Logo.png",
  },
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
    <html lang="fr" className={inter.variable}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="font-sans bg-white text-gray-700 antialiased overflow-x-clip min-w-0">
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
