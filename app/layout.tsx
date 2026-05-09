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
        <link rel="preconnect" href="https://causio.fr" />
        {/* Causio : apiUrl requis si document.currentScript est indisponible au bootstrap */}
        <Script id="causio-config" strategy="beforeInteractive">
          {`
            window.CAUSIO_CONFIG = {
              chatbotId: "a57fefed-3176-4771-9aae-e7e93c54e1d0",
              apiUrl: "https://causio.fr",
            };
          `}
        </Script>
      </head>
      <body className="font-sans bg-white text-gray-700 antialiased overflow-x-clip min-w-0">
        <BetaModalProvider>
          {children}
          <BetaModal />
        </BetaModalProvider>

        {/* Nettoyage Crisp (cache), puis chargement widget via <Script src> (currentScript fiable). */}
        <Script id="causio-crisp-cleanup" strategy="afterInteractive">
          {`
            (function () {
              try {
                if (window.$crisp && typeof window.$crisp.push === "function") {
                  try { window.$crisp.push(["do", "chat:close"]); } catch (e) {}
                  try { window.$crisp.push(["do", "chat:hide"]); } catch (e) {}
                }
              } catch (e) {}
              try {
                delete window.CRISP_WEBSITE_ID;
                window.$crisp = [];
              } catch (e) {}
              try {
                document
                  .querySelectorAll('script[src*="crisp.chat"], script[src*="client.crisp"]')
                  .forEach(function (n) { n.remove(); });
                document
                  .querySelectorAll('iframe[src*="crisp"], iframe[id*="crisp"]')
                  .forEach(function (n) { n.remove(); });
                ["crisp-root", "crisp-chatbox", "crisp-client"].forEach(function (id) {
                  var el = document.getElementById(id);
                  if (el) el.remove();
                });
              } catch (e) {}
              try {
                var ls = window.localStorage;
                for (var i = ls.length - 1; i >= 0; i--) {
                  var k = ls.key(i);
                  if (k && /crisp/i.test(k)) ls.removeItem(k);
                }
                var ss = window.sessionStorage;
                for (var j = ss.length - 1; j >= 0; j--) {
                  var sk = ss.key(j);
                  if (sk && /crisp/i.test(sk)) ss.removeItem(sk);
                }
              } catch (e) {}
            })();
          `}
        </Script>
        <Script
          id="causio-widget"
          src="https://causio.fr/widget.js?v=dpl_4LkWXpo6ysAptuZTut3Rg2BVJpuq"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
