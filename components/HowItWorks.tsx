import Reveal from "./Reveal";
import CtaButton from "./CtaButton";

// === HOW IT WORKS (Section D) ===
// Flux normal sur tous les breakpoints — pas de sticky / scroll-jacking qui
// clippe le contenu dans un viewport fixe.

type Step = {
  num: string;
  title: string;
  body: string;
  Icon: () => React.JSX.Element;
};

function MapIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
      <line x1="8" y1="2" x2="8" y2="18" />
      <line x1="16" y1="6" x2="16" y2="22" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}

function RouteIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="19" r="3" />
      <circle cx="18" cy="5" r="3" />
      <path d="M6 16V8a4 4 0 0 1 4-4h4" />
      <path d="M18 8v8a4 4 0 0 1-4 4h-4" />
    </svg>
  );
}

const STEPS: Step[] = [
  {
    num: "01",
    title: "Réservez votre secteur",
    body: "Votre zone est exclusive : une seule agence par secteur. Nous la délimitons ensemble lors d'un appel de 20 minutes.",
    Icon: MapIcon,
  },
  {
    num: "02",
    title: "Recevez votre liste du lundi",
    body: "Chaque lundi, les nouvelles adresses scorées arrivent dans votre tableau de bord, avec les signaux — dont les événements de vie sur le bien — qui expliquent chaque score.",
    Icon: ListIcon,
  },
  {
    num: "03",
    title: "Envoyez vos agents au bon endroit",
    body: "Chaque adresse part avec son contexte : signaux, copropriété, historique du bien. Export CSV ou lien Google Maps pour le terrain.",
    Icon: RouteIcon,
  },
];

function StepCard({ step, index }: { step: Step; index: number }) {
  return (
    <Reveal direction="up" delay={index * 90} className="h-full min-w-0">
      <div className="glass grad-border relative flex h-full flex-col overflow-hidden rounded-[24px] p-6 sm:p-7">
        <div className="font-display text-5xl sm:text-6xl leading-none font-bold">
          <span className="text-grad">{step.num}</span>
        </div>
        <div className="mt-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/12 text-accent-dark">
          <step.Icon />
        </div>
        <h3 className="text-h3 text-balance mt-4">{step.title}</h3>
        <p className="text-body mt-2 flex-1">{step.body}</p>
      </div>
    </Reveal>
  );
}

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="relative z-10 bg-canvas py-14 sm:py-20 lg:py-28">
      <div className="mx-auto w-full max-w-6xl min-w-0 px-4 sm:px-8">
        <Reveal direction="up">
          <h2 className="text-h1 headline mx-auto max-w-3xl text-balance px-1 text-center">
            De votre secteur au terrain, en trois étapes.
          </h2>
        </Reveal>

        <div className="mt-10 grid grid-cols-1 items-stretch gap-4 sm:mt-12 sm:gap-6 md:grid-cols-2 lg:mt-14 lg:grid-cols-3 lg:gap-8">
          {STEPS.map((step, i) => (
            <div
              key={step.num}
              className={`min-w-0 ${i === 2 ? "md:col-span-2 lg:col-span-1" : ""}`}
            >
              <StepCard step={step} index={i} />
            </div>
          ))}
        </div>

        <Reveal direction="scale" delay={250} className="mt-10 flex justify-center px-1 sm:mt-12 lg:mt-14">
          <CtaButton className="max-w-full">
            Réserver une démo
            <span data-arrow aria-hidden>
              →
            </span>
          </CtaButton>
        </Reveal>
      </div>
    </section>
  );
}
