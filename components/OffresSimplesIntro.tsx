import Reveal from "./Reveal";
import CtaButton from "./CtaButton";
import CapsuleGlyph from "@/components/landing/CapsuleGlyph";

const OFFRES = [
  {
    id: "essai",
    step: "Pour démarrer",
    featured: false,
    priceMain: "Gratuit",
    priceSide: null as string | null,
    priceUnit: null as string | null,
    sub: "1 mois · sans engagement",
    body: "Tout Priimo pendant 30 jours. Installation et implémentation offertes.",
  },
  {
    id: "agence",
    step: "Si ça vous plaît",
    featured: true,
    badge: "Offre agence",
    priceMain: "70",
    priceSide: "€ HT",
    priceUnit: "/ mois",
    sub: "3 sièges inclus",
    body: "Après l’essai : votre agence tourne à plein, jusqu’à trois négociateurs.",
  },
  {
    id: "siege",
    step: "Pour aller plus loin",
    featured: false,
    priceMain: "+50",
    priceSide: "€ HT",
    priceUnit: "/ mois",
    sub: "par siège supplémentaire",
    body: "Au-delà des 3 sièges inclus : +50 € HT / mois pour chaque négociateur en plus.",
  },
] as const;

/** Trois cartes = une offre en étapes — placée juste sous WhyPriimo. */
export default function OffresSimplesIntro() {
  return (
    <section className="offres-simples" aria-labelledby="offres-simples-title">
      <Reveal direction="up" className="offres-simples-inner">
        <h2 id="offres-simples-title" className="offres-simples-title">
          <span className="offres-simples-lead">Une</span>
          <span className="offres-simples-capsule">
            <CapsuleGlyph kind="ticket" className="offres-simples-capsule-icon" />
            offre simple
          </span>
        </h2>

        <div className="offres-simples-grid">
          {OFFRES.map((offre, i) => (
            <article
              key={offre.id}
              className={`offres-simples-card${offre.featured ? " is-featured" : ""}`}
              style={{ ["--offres-i" as string]: i }}
            >
              <p className="offres-simples-card-step">
                <span className="offres-simples-card-step-num" aria-hidden>
                  {i + 1}
                </span>
                {offre.step}
              </p>
              {"badge" in offre && offre.badge ? (
                <span className="offres-simples-card-badge">{offre.badge}</span>
              ) : null}
              <div className="offres-simples-card-price" aria-label={priceLabel(offre)}>
                <span className="offres-simples-card-price-main">{offre.priceMain}</span>
                {offre.priceSide || offre.priceUnit ? (
                  <span className="offres-simples-card-price-meta">
                    {offre.priceSide ? <span>{offre.priceSide}</span> : null}
                    {offre.priceUnit ? <span>{offre.priceUnit}</span> : null}
                  </span>
                ) : null}
              </div>
              <p className="offres-simples-card-sub">{offre.sub}</p>
              <p className="offres-simples-card-body">{offre.body}</p>
            </article>
          ))}
        </div>

        <div className="offres-simples-actions">
          <CtaButton className="offres-simples-cta" size="lg">
            Démarrer gratuitement
          </CtaButton>
          <p className="offres-simples-foot">
            Sans engagement · facturation directe avec l’agence
          </p>
        </div>
      </Reveal>
    </section>
  );
}

function priceLabel(offre: (typeof OFFRES)[number]): string {
  if (!offre.priceSide && !offre.priceUnit) return offre.priceMain;
  return `${offre.priceMain} ${offre.priceSide ?? ""} ${offre.priceUnit ?? ""}`.replace(
    /\s+/g,
    " ",
  ).trim();
}
