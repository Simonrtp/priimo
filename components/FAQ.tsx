"use client";

import { useState } from "react";
import Reveal from "./Reveal";
import CtaButton from "./CtaButton";

// === FAQ (Section I) ===
// Accordion: click to expand. Animation via CSS max-height + opacity.

type Item = {
  q: string;
  a: string;
};

const FAQS: Item[] = [
  {
    q: "C'est quoi exactement Priimo ?",
    a: "Priimo est un logiciel de prospection prédictive qui croise les données DVF (transactions notariales) et DPE (diagnostics énergétiques) pour identifier les propriétaires les plus susceptibles de vendre dans les 6 prochains mois sur votre zone. Vous recevez chaque semaine une liste d'adresses à prospecter, scorées et priorisées.",
  },
  {
    q: "L'essai est-il vraiment gratuit ?",
    a: "Oui. Vous pouvez créer un compte et tester Priimo gratuitement, sans engagement et sans carte bancaire. En échange, nous apprécions vos retours pour continuer à améliorer le produit.",
  },
  {
    q: "Combien ça coûte ensuite ?",
    a: "Le tarif fondateur pour les premiers inscrits est de 99 €/mois, garanti à vie. Le tarif public est de 149 €/mois.",
  },
  {
    q: "Ça remplace Maline ou Telescop ?",
    a: "Priimo fait le même travail de détection de vendeurs potentiels, avec une interface conçue pour être opérationnelle sans formation. Nous sommes 3x moins chers et sans engagement.",
  },
  {
    q: "Est-ce que c'est conforme RGPD ?",
    a: "Oui. Priimo utilise exclusivement des données publiques (DVF, DPE, cadastre) — aucune donnée personnelle n'est collectée sans consentement. Le porte-à-porte sur une adresse est légal et ne nécessite aucun consentement préalable.",
  },
  {
    q: "Combien de temps pour être opérationnel ?",
    a: "20 minutes. Vous définissez votre zone sur la carte, et votre première liste de prospects apparaît immédiatement. Aucune formation requise.",
  },
];

function FAQItem({ q, a, isOpen, onToggle, idx }: Item & { isOpen: boolean; onToggle: () => void; idx: number }) {
  const id = `faq-${idx}`;
  return (
    <div className="border-b border-black/8">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={id}
        className="w-full flex items-start sm:items-center justify-between gap-3 py-5 text-left min-w-0"
      >
        <h3 className="text-h3 text-gray-900 min-w-0 flex-1 pr-2 text-balance">{q}</h3>
        <span className={`faq-chevron shrink-0 text-gray-500 ${isOpen ? "open" : ""}`} aria-hidden>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </button>
      <div id={id} className={`faq-content ${isOpen ? "open" : ""}`}>
        <p className="pb-5 pr-8 text-body">{a}</p>
      </div>
    </div>
  );
}

export default function FAQ() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  return (
    <section className="py-14 sm:py-24">
      <div className="mx-auto max-w-3xl px-4 sm:px-8 min-w-0">
        <Reveal direction="up">
          <h2 className="text-h2 text-center text-gray-900 text-balance px-1 mb-subheading">
            Questions fréquentes
          </h2>
        </Reveal>

        <Reveal direction="up" delay={120} className="mt-8 sm:mt-10">
          <div className="rounded-2xl border border-black/8 bg-white/60 px-4 sm:px-7">
            {FAQS.map((item, i) => (
              <FAQItem
                key={item.q}
                idx={i}
                q={item.q}
                a={item.a}
                isOpen={openIdx === i}
                onToggle={() => setOpenIdx(openIdx === i ? null : i)}
              />
            ))}
          </div>
        </Reveal>

        <Reveal direction="scale" delay={250} className="mt-10 flex justify-center">
          <CtaButton>
            Réserver une démo
            <span aria-hidden>→</span>
          </CtaButton>
        </Reveal>
      </div>
    </section>
  );
}
