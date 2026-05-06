import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { BetaModalProvider } from "@/components/BetaModalContext";
import BetaModal from "@/components/BetaModal";

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
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

// === SEO ===
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Priimo — Trouvez vos mandats vendeurs avant vos concurrents",
    template: "%s · Priimo",
  },
  description:
    "Priimo est le logiciel de prospection immobilière prédictive qui croise DVF, DPE et signaux de vie pour identifier les vendeurs avant qu'ils soient sur le marché. Bêta privée ouverte.",
  applicationName: "Priimo",
  keywords: [
    "prospection immobilière",
    "mandats vendeurs",
    "DVF",
    "DPE",
    "logiciel immobilier",
    "agence immobilière",
    "prédictif",
  ],
  authors: [{ name: "Priimo" }],
  creator: "Priimo",
  robots: { index: true, follow: true },
  alternates: { canonical: "/" },
  openGraph: {
    title: "Priimo — Prospection immobilière prédictive",
    description:
      "Identifiez vos prochains mandats vendeurs 6 mois à l'avance. Simple, abordable, conforme.",
    url: "/",
    siteName: "Priimo",
    locale: "fr_FR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Priimo — Prospection immobilière prédictive",
    description:
      "Identifiez vos prochains mandats vendeurs 6 mois à l'avance. Simple, abordable, conforme.",
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
        <BetaModalProvider>
          {children}
          <BetaModal />
        </BetaModalProvider>

        <Script id="crisp-chat" strategy="afterInteractive">
          {`
            window.$crisp = [];
            window.CRISP_WEBSITE_ID = "713765e1-3aad-4764-894b-41c51e2a7111";
            (function () {
              var d = document;
              var s = d.createElement("script");
              s.src = "https://client.crisp.chat/l.js";
              s.async = 1;
              d.getElementsByTagName("head")[0].appendChild(s);
            })();
          `}
        </Script>
      </body>
    </html>
  );
}
