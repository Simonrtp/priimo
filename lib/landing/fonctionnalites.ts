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
  /** Ligne juste sous le titre (ex. partenaire) */
  sousTitre?: string;
  /** Logo optionnel à droite du sous-titre */
  sousTitreLogo?: { src: string; alt: string; width: number; height: number };
  /** Lien du sous-titre / logo (nouvel onglet) */
  sousTitreHref?: string;
  /** Paragraphes ; **gras** et [lien](/url) */
  paragraphes: string[];
  imageAlt: string;
  /**
   * Chemin image (défaut : `/landing/fonctionnalites/{slug}.webp`).
   * Ex. `.png` tant que le webp n’est pas prêt.
   */
  imageSrc?: string;
  /**
   * Sources vidéo (webm puis mp4). Si présent, remplace l’image dans le cadre.
   */
  videoSrcs?: { src: string; type: string }[];
  /** Visuel React dédié (ex. orbite portails) — prioritaire sur image/vidéo. */
  visuel?: "diffusion-orbit";
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
      "**À la porte.** Votre secteur se découpe en zones de tournée. Chaque immeuble a sa fiche : **données publiques** et **notes privées** de l’agence. C’est le sens de [prospecter sans le téléphone](/blog/prospecter-sans-telephone).",
      "**Avant de sortir.** Priimo priorise les adresses à voir cette semaine, selon les signaux et ce que vous savez déjà du quartier. Moins de portes au hasard, **plus de visites utiles**.",
    ],
    imageAlt: "Téléphone Priimo : carte de secteur et contexte d’un immeuble",
    imageSrc: "/landing/fonctionnalites/prospection-phone.webp",
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
    videoSrcs: [
      { src: "/priimo-dictee-terrain.webm", type: "video/webm" },
      { src: "/priimo-dictee-terrain.mp4", type: "video/mp4" },
    ],
    enSavoirPlusHref: "/fonctionnalites/terrain",
    degrade: "linear-gradient(160deg, #ffe0e8 0%, #f7c4d0 45%, #f07890 100%)",
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
    imageAlt: "Ordinateur Priimo : atelier d’estimation, fiche bien et couverture du rapport",
    imageSrc: "/landing/fonctionnalites/estimations-laptop.webp",
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
    sousTitre: "Propulsé par",
    sousTitreHref: "https://www.ubiflow.net/",
    sousTitreLogo: {
      src: "/landing/fonctionnalites/ubiflow.webp",
      alt: "Ubiflow",
      width: 186,
      height: 50,
    },
    paragraphes: [
      "Saisissez le bien une seule fois dans Priimo, il part sur les portails immobiliers. **Pas d’export, pas de double saisie.**",
      "Les demandes des acheteurs reviennent directement dans Priimo, **rattachées au bon bien**, prêtes à être traitées.",
    ],
    imageAlt: "+400 portails de vente reliés à Priimo",
    visuel: "diffusion-orbit",
    enSavoirPlusHref: "/fonctionnalites/pipeline",
    degrade: "linear-gradient(165deg, #ffffff 0%, #f7f8fb 55%, #eef1f6 100%)",
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
    imageSrc: "/landing/fonctionnalites/pilotage-laptop.webp",
    enSavoirPlusHref: "/fonctionnalites/pilotage",
    degrade: "linear-gradient(160deg, #f4f1ec 0%, #e8e2d8 55%, #d9d2c6 100%)",
  },
];

export function imageFonctionnalite(carte: Pick<FonctionnaliteCarte, "slug" | "imageSrc">): string {
  return carte.imageSrc ?? `/landing/fonctionnalites/${carte.slug}.webp`;
}

/** URLs à précharger pour des changements d’onglet instantanés. */
export function mediasFonctionnalitesAPrecharger(): string[] {
  const urls = new Set<string>();
  for (const carte of FONCTIONNALITES) {
    if (carte.imageSrc) urls.add(carte.imageSrc);
    if (carte.sousTitreLogo?.src) urls.add(carte.sousTitreLogo.src);
    for (const v of carte.videoSrcs ?? []) urls.add(v.src);
  }
  // Logos marquee diffusion — import dynamique évité ici pour garder ce module léger côté serveur
  for (const id of [
    "bienici",
    "jinka",
    "greenacres",
    "logicimmo",
    "meilleursagents",
    "paruvendu",
    "superimmo",
    "superneuf",
    "etreproprio",
    "luxresidence",
    "bellesdemeures",
    "proprietesfigaro",
    "properstar",
    "seloger",
    "leboncoin",
    "figaroimmobilier",
  ]) {
    urls.add(`/landing/portails/marquee/${id}.webp`);
  }
  return [...urls];
}
