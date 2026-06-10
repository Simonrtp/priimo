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
    q: "C'est quoi exactement, Priimo ?",
    a: "Priimo croise cinq bases publiques françaises (DVF, DPE, BODACC, copropriétés, permis) pour repérer les signaux qui précèdent une mise en vente : DPE refait, ventes en série dans un immeuble, copropriété fragilisée, SCI en dissolution. Chaque semaine, vous recevez une liste d'adresses scorées et priorisées sur votre secteur exclusif — avec le contexte pour agir.",
  },
  {
    q: "Comment essayer Priimo ?",
    a: "L'accès se fait sur invitation, après un échange de 20 minutes pour délimiter votre secteur et vérifier qu'il est disponible. Chaque agence démarre ensuite par un mois d'essai gratuit, sans carte bancaire et sans engagement. En échange, nous vous demandons une chose : nous dire ce que donnent les adresses sur le terrain.",
  },
  {
    q: "Combien ça coûte ?",
    a: "Les dix premières agences bénéficient du tarif fondateur : 100 €/mois, garanti 12 mois, en échange de retours réguliers. Le tarif standard est de 199 €/mois. Sans engagement de durée, avec un secteur exclusif par agence. Un seul mandat supplémentaire rembourse largement une année d'abonnement.",
  },
  {
    q: "Quelle différence avec Maline ou Telescop ?",
    a: "Le même socle de données publiques, une philosophie différente. Là où ces outils misent sur le volume et demandent une vraie prise en main, Priimo livre une liste courte et priorisée — 15 à 30 adresses par mois, expliquées une à une — plus un module SCI avec dirigeants identifiés. Et votre secteur est exclusif : une seule agence par zone.",
  },
  {
    q: "Est-ce conforme au RGPD ?",
    a: "Priimo travaille exclusivement à partir de bases publiques françaises. Pour les particuliers, nous fournissons des adresses et des signaux — jamais de nom ni de téléphone : votre prospection se fait sur le terrain ou par courrier, en conformité avec l'interdiction de la pige téléphonique (août 2025). Pour les sociétés, les informations de dirigeants proviennent de registres légaux publics.",
  },
  {
    q: "Combien de temps pour être opérationnel ?",
    a: "Un appel de 20 minutes pour délimiter votre secteur, une invitation, et votre première liste vous attend à la connexion. Aucune installation, aucune formation : si votre équipe sait lire une liste d'adresses, elle sait utiliser Priimo. Le tableau de bord fonctionne sur ordinateur comme sur mobile.",
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
