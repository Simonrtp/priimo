import Image from "next/image";
import Reveal from "./Reveal";
import LogicielOnglets from "./LogicielOnglets";

/**
 * Pourquoi les agences adorent Priimo — 3 piliers (style Tiime).
 * Visuels 3D : bouton = Simple, clé = Exclusif, bouclier = RGPD.
 */

type Pilier = {
  titre: string;
  texte: string;
  src: string;
};

const PILIERS: Pilier[] = [
  {
    titre: "Simple",
    texte: "Prise en main immédiate. L’essentiel, sans menus inutiles.",
    src: "/bou.png?v=3",
  },
  {
    titre: "Exclusif",
    texte: "Un secteur ne se partage pas. L’avantage reste le vôtre.",
    src: "/why-exclusif.png?v=3",
  },
  {
    titre: "100% RGPD",
    texte: "Des données traitées en conformité. Rien n’est bradé.",
    src: "/boucl.png?v=3",
  },
];

export default function WhyPriimo() {
  return (
    <section className="why-priimo" aria-label="Pourquoi les agences choisissent Priimo">
      <div className="why-priimo-inner">
        <ul className="why-priimo-grid">
          {PILIERS.map((pilier, i) => (
            <Reveal
              key={pilier.titre}
              as="li"
              direction="up"
              delay={i * 80}
              className="why-priimo-card"
            >
              <span className="why-priimo-icon" aria-hidden>
                <Image
                  src={pilier.src}
                  alt=""
                  width={160}
                  height={160}
                  className="why-priimo-img"
                  sizes="160px"
                  unoptimized
                />
              </span>
              <h3 className="why-priimo-title">{pilier.titre}</h3>
              <p className="why-priimo-text">{pilier.texte}</p>
            </Reveal>
          ))}
        </ul>
      </div>

      <Reveal direction="up" delay={120} className="why-priimo-outro">
        <h2 className="why-priimo-outro-title">
          Un logiciel tout-en-un simplissime
        </h2>
        <p className="why-priimo-outro-text">
          Prospection prédictive - Données - Terrain
        </p>
      </Reveal>

      <LogicielOnglets />
    </section>
  );
}
