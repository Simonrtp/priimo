import type { Metadata } from "next";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import FinalCTA from "@/components/FinalCTA";
import CtaButton from "@/components/CtaButton";
import FaqAccordion from "@/components/faq/FaqAccordion";
import { FAQ_ALL, FAQ_GROUPS, faqAnswerPlain } from "@/lib/landing/faq";

export const metadata: Metadata = {
  title: "Questions fréquentes",
  description:
    "Adoption, données, prix et engagement : les réponses qu'un directeur d'agence se pose avant de démarrer Priimo.",
  alternates: { canonical: "/faq" },
  openGraph: {
    title: "Questions fréquentes — Priimo",
    description:
      "Adoption, données, prix et engagement : les réponses qu'un directeur d'agence se pose avant de démarrer Priimo.",
    url: "/faq",
    type: "website",
    locale: "fr_FR",
    siteName: "Priimo",
    images: [{ url: "/Tintin_image_2.jpg", alt: "Priimo" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Questions fréquentes — Priimo",
    description:
      "Adoption, données, prix et engagement : les réponses qu'un directeur d'agence se pose avant de démarrer Priimo.",
    images: ["/Tintin_image_2.jpg"],
  },
  robots: { index: true, follow: true },
};

function faqJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_ALL.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: faqAnswerPlain(item.a),
      },
    })),
  };
}

export default function FaqPage() {
  const jsonLd = JSON.stringify(faqJsonLd()).replace(/</g, "\\u003c");

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <SiteHeader />
      <main className="faq-page mx-auto w-full max-w-6xl px-5 pb-16 pt-28 sm:px-8 sm:pb-24 sm:pt-32 min-w-0">
        <header>
          <h1 className="text-h1 text-balance">Questions fréquentes</h1>
          <p className="mt-4 text-pretty text-[17px] leading-relaxed text-gray-600">
            Les questions qu'un directeur se pose avant de payer.
          </p>
        </header>

        <div className="mt-12 space-y-12">
          {FAQ_GROUPS.map((group) => (
            <section key={group.id} aria-labelledby={`faq-group-${group.id}`}>
              <h2
                id={`faq-group-${group.id}`}
                className="mb-4 text-[13px] font-semibold uppercase text-gray-500"
              >
                {group.title}
              </h2>
              <FaqAccordion items={group.items} idPrefix={group.id} />
            </section>
          ))}
        </div>

        <div className="mt-12 border-t border-black/8 pt-8">
          <CtaButton className="px-6 py-3 text-[15px]">
            Réserver une démo
            <span data-arrow aria-hidden>→</span>
          </CtaButton>
          <p className="mt-4 text-[14px] text-gray-500">
            Une question qui n'est pas là ?{" "}
            <Link href="mailto:hello@priimo.fr" className="font-semibold text-accent-dark hover:underline">
              hello@priimo.fr
            </Link>
          </p>
        </div>
      </main>
      <FinalCTA />
    </>
  );
}
