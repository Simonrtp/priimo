import type { Metadata, Viewport } from "next";
import { Nunito, Plus_Jakarta_Sans } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { BetaModalProvider } from "@/components/BetaModalContext";
import BetaModal from "@/components/BetaModal";

// === FONTS ===
// Display: Nunito — rounded, friendly, professional (titles)
// Body:    Plus Jakarta Sans — clean, modern, readable
const nunito = Nunito({
  subsets: ["latin"],
  weight: ["600", "700", "800", "900"],
  variable: "--font-display",
  display: "swap",
});

const jakarta = Plus_Jakarta_Sans({
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
  // Favicon + Apple touch icon (same asset as header / OG — public/Logo.png).
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
    <html lang="fr" className={`${nunito.variable} ${jakarta.variable}`}>
      <body className="bg-white text-ink antialiased overflow-x-clip min-w-0">
        <BetaModalProvider>
          {children}
          {/* Global beta modal — opened by any CTA except the inline hero form */}
          <BetaModal />
        </BetaModalProvider>

        {/* === CRISP CHAT ===
            Loaded after the page becomes interactive so it never blocks the
            first paint or the hydration. Crisp's own snippet injects its
            <script src="https://client.crisp.chat/l.js"> into <head>.       */}
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
