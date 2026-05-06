import Reveal from "./Reveal";

// === FEATURES (Section E) ===
// 2x2 grid on desktop, single column on mobile. White cards, accent icon.

type Feature = {
  title: string;
  body: string;
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
    title: "Scoring prédictif DVF + DPE",
    body: "Priimo croise les transactions notariales, les diagnostics énergétiques et les signaux de vie pour attribuer un score de probabilité de vente à chaque bien de votre zone.",
    Icon: ChartIcon,
  },
  {
    title: "Carte interactive des prospects",
    body: "Visualisez vos prospects sur une carte, filtrez par score, et générez un itinéraire optimisé pour chaque agent en un clic.",
    Icon: MapPinIcon,
  },
  {
    title: "Tableau de bord directeur",
    body: "Suivez la couverture terrain de votre équipe, les contacts passés cette semaine, et les prospects chauds encore non contactés.",
    Icon: DashboardIcon,
  },
  {
    title: "Export et partage",
    body: "Exportez votre liste en CSV ou partagez un lien Google Maps directement avec vos agents sur le terrain.",
    Icon: ShareIcon,
  },
];

export default function Features() {
  return (
    <section className="py-14 sm:py-24">
      <div className="relative mx-auto max-w-6xl px-4 sm:px-8 min-w-0">
        <Reveal direction="up">
          <h2 className="text-h2 text-center max-w-3xl mx-auto text-balance px-1 mb-subheading">
            Tout ce dont une agence a besoin pour prospecter intelligemment.
          </h2>
        </Reveal>

        <div className="grid md:grid-cols-2 gap-5 lg:gap-6 mt-10 sm:mt-12 min-w-0">
          {FEATURES.map((f, i) => {
            // Per-card animation choreography:
            // - Cards 0 and 2 enter from the LEFT, 1 and 3 from the RIGHT.
            // - Strong stagger so the grid "draws itself" instead of all at once.
            const direction = i % 2 === 0 ? "left" : "right";
            const delay = i * 130;

            // Alternate icon chips between orange and slate blue
            const isWarm = i % 2 === 0;
            const iconChip = isWarm
              ? "bg-accent/10 text-accent-dark"
              : "bg-blue/10 text-blue-dark";

            return (
              <Reveal key={f.title} direction={direction} delay={delay} className="h-full">
                <div className="group h-full rounded-2xl bg-white border border-black/5 shadow-soft p-6 sm:p-7 transition-all duration-500 ease-out hover:-translate-y-1.5 hover:shadow-xl hover:border-accent/20">
                  <div
                    className={`inline-flex h-11 w-11 items-center justify-center rounded-xl ${iconChip} transition-all duration-500 ease-out group-hover:scale-110 group-hover:rotate-[-4deg]`}
                  >
                    <f.Icon />
                  </div>
                    <h3 className="text-h3 mt-5 transition-colors duration-300 group-hover:text-accent-dark">
                      {f.title}
                    </h3>
                    <p className="text-body mt-2">
                    {f.body}
                  </p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
