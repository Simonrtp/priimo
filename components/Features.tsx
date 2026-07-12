import Link from "next/link";
import Reveal from "./Reveal";

// === FEATURES (Section E) ===
// Refonte 2.0 : bento grid asymétrique (cartes larges 0 & 3, étroites 1 & 2),
// surfaces verre, bordure dégradée rotative au survol, chips d'icône en relief.
// Textes inchangés.

type Feature = {
  title: string;
  body: string;
  href: string;
  Icon: () => React.JSX.Element;
};

function ChartIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

function MapPinIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function DashboardIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="9" />
      <rect x="14" y="3" width="7" height="5" />
      <rect x="14" y="12" width="7" height="9" />
      <rect x="3" y="16" width="7" height="5" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}

const FEATURES: Feature[] = [
  {
    title: "Un score prédictif sur chaque adresse",
    body: "DVF, DPE ADEME, BODACC, registre des copropriétés, permis de construire : Priimo croise les signaux qui précèdent une vente et calcule une probabilité de vente de 0 à 100 pour chaque adresse de votre secteur.",
    href: "/fonctionnalites/scoring",
    Icon: ChartIcon,
  },
  {
    title: "Le module Entreprises : SCI et dirigeants",
    body: "Dissolutions, liquidations, cessions de parts publiées au BODACC — avec l'identité du dirigeant et ses coordonnées professionnelles. Des mandats que personne d'autre ne voit venir.",
    href: "/fonctionnalites/sci",
    Icon: MapPinIcon,
  },
  {
    title: "Le suivi de votre équipe",
    body: "Statuts, assignation, notes : vous voyez qui travaille quoi, ce qui a donné un rendez-vous, et ce qui reste à couvrir.",
    href: "/fonctionnalites/livraison#suivi",
    Icon: DashboardIcon,
  },
  {
    title: "Export et partage en un clic",
    body: "Exportez votre liste en CSV ou partagez un lien Google Maps : vos agents ont leurs adresses en poche sur le terrain.",
    href: "/fonctionnalites/livraison#export",
    Icon: ShareIcon,
  },
];

// Score gauge décoratif pour la carte vedette (valeurs « 0 » et « 100 » déjà
// présentes dans le texte). Purement graphique.
function ScoreGauge() {
  return (
    <div className="mt-6" aria-hidden>
      <div className="flex items-center justify-between text-[11px] font-semibold text-gray-400">
        <span>0</span>
        <span className="text-accent-dark">Probabilité de vente</span>
        <span>100</span>
      </div>
      <div className="relative mt-2 h-2.5 w-full overflow-hidden rounded-full bg-black/5">
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            width: "84%",
            background: "linear-gradient(90deg,#818cf8,#c7d2fe,#f6ad63,#e8743c)",
          }}
        />
        <span
          className="absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border-2 border-white bg-accent shadow-[0_4px_10px_-2px_rgba(232,116,60,0.7)]"
          style={{ left: "calc(84% - 8px)" }}
        />
      </div>
    </div>
  );
}

export default function Features() {
  return (
    <section id="features" className="py-16 sm:py-28">
      <div className="relative mx-auto max-w-6xl px-4 sm:px-8 min-w-0">
        <Reveal direction="up">
          <div className="flex justify-center">
            <span className="kicker kicker--indigo mb-5">
              <span className="kicker__dot" />
              Moteur prédictif
            </span>
          </div>
          <h2 className="text-h2 text-center max-w-3xl mx-auto text-balance px-1">
            Un moteur prédictif fait le tri. Vos agents font les mandats.
          </h2>
        </Reveal>

        <div className="grid min-w-0 grid-cols-1 gap-5 sm:gap-6 md:grid-cols-2 lg:grid-cols-3 lg:gap-6 mt-12">
          {FEATURES.map((f, i) => {
            // Bento : cartes 0 et 3 larges (2 colonnes sur lg), 1 et 2 étroites.
            const wide = i === 0 || i === 3;
            const span = wide ? "lg:col-span-2" : "lg:col-span-1";
            const direction = i % 2 === 0 ? "left" : "right";
            const delay = i * 120;
            // Duotone : chips orange (chaud) / indigo (cool) en alternance ;
            // panneaux larges teintés — 0 chaud, 3 froid.
            const isWarm = i % 2 === 0;
            const iconChip = isWarm
              ? "bg-accent/10 text-accent-dark"
              : "bg-indigo-500/10 text-indigo-600";
            const panelTint = i === 0 ? "warm-panel" : i === 3 ? "cool-panel" : "";

            return (
              <Reveal key={f.title} direction={direction} delay={delay} className={`h-full ${span}`}>
                <Link
                  href={f.href}
                  className={`group glass glass-hover grad-border relative block h-full overflow-hidden rounded-[24px] p-6 sm:p-8 ${panelTint} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent/50`}
                >
                  <div
                    className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${iconChip} shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] transition-transform duration-500 ease-out group-hover:scale-110 group-hover:-rotate-6`}
                  >
                    <f.Icon />
                  </div>
                  <h3 className="text-h3 mt-5 transition-colors duration-300 group-hover:text-accent-dark">
                    {f.title}
                  </h3>
                  <p className="text-body mt-2 max-w-xl">{f.body}</p>
                  {i === 0 && <ScoreGauge />}
                </Link>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
