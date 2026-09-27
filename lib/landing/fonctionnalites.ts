import {
  BarChart3,
  FileText,
  Megaphone,
  Mic,
  Radar,
  type LucideIcon,
} from "lucide-react";

/**
 * Contenu des 5 cartes « fonctionnalités » (landing).
 * Modifier ici uniquement — le composant ne contient pas de copy.
 *
 * Dans les paragraphes :
 * - **mots** = gras
 * - [libellé](/blog/slug) = lien blog inline
 */
export type FonctionnaliteCarte = {
  slug: string;
  onglet: string;
  Icon: LucideIcon;
  /** Couleur de l’icône quand l’onglet est actif */
  couleurIcone: string;
  /** Badge optionnel sous le label d’onglet (ex. « Le cœur ») */
  badge?: string;
  /** Badge « Bientôt » sur l’onglet — off par défaut */
  bientot?: boolean;
  titre: string;
  /** Paragraphes ; **gras** et [lien](/url) */
  paragraphes: string[];
  imageAlt: string;
  /**
   * Chemin image (défaut : `/landing/fonctionnalites/{slug}.webp`).
   * Ex. `.png` tant que le webp n’est pas prêt.
   */
  imageSrc?: string;
  /** Affichage dans le cadre : cover (défaut) ou contain (mockup téléphone). */
  imageFit?: "cover" | "contain";
  /** Lien du bouton secondaire « En savoir plus » */
  enSavoirPlusHref: string;
  /** Dégradé CSS du bloc visuel à droite */
  degrade: string;
};

export const FONCTIONNALITES: FonctionnaliteCarte[] = [
  {
    slug: "prospection",
    onglet: "Prospection intelligente",
    Icon: Radar,
    couleurIcone: "#FFD400",
    badge: "Depuis le 11 août",
    bientot: false,
    titre: "La pige est terminée. Le terrain reprend.",
    paragraphes: [
      "Depuis le 11 août 2026, appeler un particulier sans son accord est interdit. **La pige téléphonique, c’est fini**, et [voici ce qui change concrètement](/blog/fin-pige-telephonique). Ce qui reste, c’est le terrain : **savoir où frapper avant de sortir**.",
      "**À la porte.** Sur la carte, votre secteur se découpe en zones de tournée. Chaque immeuble a sa fiche : **données publiques** (ventes, prix au m², copropriété, diagnostics) et **notes privées** de l’agence. C’est aussi le sens de [prospecter sans le téléphone](/blog/prospecter-sans-telephone).",
      "**Avant de sortir.** Priimo priorise les adresses à voir cette semaine, selon les signaux et ce que vous savez déjà du quartier. Moins de portes au hasard, **plus de visites utiles**.",
    ],
    imageAlt: "Téléphone Priimo : carte de secteur et contexte d’un immeuble",
    imageSrc: "/téléphonoooo.png",
    imageFit: "contain",
    enSavoirPlusHref: "/fonctionnalites/detection",
    degrade: "linear-gradient(155deg, #ffd400 0%, #ffe566 38%, #fff6c8 72%, #fffceb 100%)",
  },
  {
    slug: "dictee",
    onglet: "Dictée terrain",
    Icon: Mic,
    couleurIcone: "#FF2D6B",
    bientot: false,
    titre: "Le CRM qui se remplit en marchant",
    paragraphes: [
      "Sur le terrain, un tap et vous parlez. Priimo transcrit, rattache **le contact, l’immeuble et la date de relance**, puis vous propose de tout ranger. Vous validez d’un geste.",
      "Plus de compte rendu en fin de journée : **la saisie se fait pendant la tournée**, pas après.",
      "Chaque note reste sur l’immeuble, pas dans la tête d’un négociateur. Quand quelqu’un quitte l’agence, **le carnet du quartier reste**.",
    ],
    imageAlt: "Dictée terrain Priimo : note vocale rattachée à un immeuble",
    enSavoirPlusHref: "/fonctionnalites/terrain",
    degrade: "linear-gradient(160deg, #e8743c 0%, #f4a259 45%, #ffe8d6 100%)",
  },
  {
    slug: "estimations",
    onglet: "Estimations et avis de valeur",
    Icon: FileText,
    couleurIcone: "#E8743C",
    bientot: false,
    titre: "Un avis de valeur prêt avant de quitter le salon",
    paragraphes: [
      "Un formulaire rapide, un calcul appuyé sur **les ventes réelles du quartier**, et un avis de valeur que vous présentez directement au propriétaire.",
      "Partagez le résultat par lien, ou posez le module d’estimation **sur le site de votre agence** pour recevoir des demandes de vendeurs, avec leur accord, sans pige.",
    ],
    imageAlt: "Avis de valeur Priimo prêt à partager avec un propriétaire",
    enSavoirPlusHref: "/fonctionnalites/estimation",
    degrade: "linear-gradient(160deg, #fff8f0 0%, #f5e6d3 55%, #e8d4b8 100%)",
  },
  {
    slug: "diffusion",
    onglet: "Diffusion des mandats",
    Icon: Megaphone,
    couleurIcone: "#004AF6",
    bientot: false,
    titre: "Un mandat saisi une fois, publié partout",
    paragraphes: [
      "Saisissez le bien une seule fois dans Priimo, il part sur les portails immobiliers. **Pas d’export, pas de double saisie.**",
      "Les demandes des acheteurs reviennent directement dans Priimo, **rattachées au bon bien**, prêtes à être traitées.",
    ],
    imageAlt: "Diffusion d’un mandat Priimo vers les portails immobiliers",
    enSavoirPlusHref: "/fonctionnalites/pipeline",
    degrade: "linear-gradient(160deg, #3d5a80 0%, #5c7fa3 48%, #b8d4ee 100%)",
  },
  {
    slug: "pilotage",
    onglet: "Pilotage commercial",
    Icon: BarChart3,
    couleurIcone: "#12B76A",
    bientot: false,
    titre: "Un coach, pas un tableau de bord",
    paragraphes: [
      "Fixez vos objectifs, Priimo les découpe en **actions du jour** pour chaque négociateur : contacts, estimations, mandats, ventes.",
      "Il montre où l’entonnoir se bloque : beaucoup de contacts et peu d’estimations, **c’est souvent la qualification qui coince**.",
      "Des chiffres mesurés, pas déclarés. Tout vient de ce que l’équipe fait dans l’appli : **rien n’est saisi à la main, donc rien n’est trafiqué**.",
    ],
    imageAlt: "Pilotage commercial Priimo : objectifs et actions du jour",
    enSavoirPlusHref: "/fonctionnalites/pilotage",
    degrade: "linear-gradient(160deg, #1a2a56 0%, #2f3f6a 50%, #5a6b8c 100%)",
  },
];

export function imageFonctionnalite(carte: Pick<FonctionnaliteCarte, "slug" | "imageSrc">): string {
  return carte.imageSrc ?? `/landing/fonctionnalites/${carte.slug}.webp`;
}
