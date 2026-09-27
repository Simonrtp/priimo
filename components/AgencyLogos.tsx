import Image from "next/image";

type Agence = {
  name: string;
  src: string;
  /** Largeur visuelle relative dans la rangée (object-contain). */
  width: number;
  /** Logo blanc sur fond noir → invert pour écriture noire. */
  invert?: boolean;
};

/** Versions couleur — toujours en couleur. */
const AGENCES: Agence[] = [
  { name: "Century 21", src: "/c21c.png", width: 148 },
  { name: "Swixim", src: "/swixx.png", width: 148 },
  /** Blanc sur noir → inversé en CSS pour écriture noire sur fond clair. */
  { name: "Leman Property", src: "/lempropt.png", width: 132, invert: true },
  { name: "Optimhome", src: "/optiorange.png", width: 148 },
];

// === AGENCY LOGOS ===
// Preuve sociale sous le hero : logos en couleur.

export default function AgencyLogos() {
  return (
    <section className="agency-logos" aria-label="Agences qui utilisent Priimo">
      <div className="agency-logos-inner">
        <p className="agency-logos-label">Ces agences adorent Priimo</p>
        <ul className="agency-logos-row">
          {AGENCES.map((agence) => (
            <li
              key={agence.name}
              className={`agency-logo-item${agence.invert ? " is-invert" : ""}`}
            >
              <Image
                src={agence.src}
                alt={agence.name}
                width={agence.width}
                height={44}
                className="agency-logo-img"
                sizes="160px"
              />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
