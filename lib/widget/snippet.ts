/**
 * Le code d'intégration, écrit à un seul endroit.
 *
 * Il apparaît dans les paramètres, dans l'email au prestataire et dans les
 * consignes par plateforme. S'il était recopié à chaque fois, une correction
 * finirait par n'être appliquée qu'à deux endroits sur trois.
 */

export const WIDGET_MOUNT_ID = 'priimo-estimation';

export function widgetSnippet(siteUrl: string, publicId: string): string {
  const base = siteUrl.replace(/\/$/, '');
  return [
    `<div id="${WIDGET_MOUNT_ID}"></div>`,
    `<script src="${base}/embed/v1.js"`,
    `        data-agency="${publicId}"></script>`,
  ].join('\n');
}

export type PlateformeGroupe = 'cms' | 'metier' | 'autre';

/** Où coller le code, plateforme par plateforme. */
export type PlateformeInstall = {
  id: string;
  nom: string;
  groupe: PlateformeGroupe;
  /** Où coller le code — une ligne utile, pas un slogan. */
  ouColler: string;
  /** Image publique ; null = pastille texte (`mark`). */
  logoSrc: string | null;
  /** Initiales si pas d’image (Netty, Apimo…). */
  mark?: string;
  /** Fond derrière le logo. */
  logoClass: string;
  /**
   * Échelle de l’image dans le carré.
   * `sm` = logo dense (Webflow) ; `md` = wordmark / cercle.
   */
  logoScale?: 'sm' | 'md';
  intro: string;
  etapes: string[];
  notes?: readonly string[];
};

export const PLATEFORME_GROUPES: readonly {
  id: PlateformeGroupe;
  titre: string;
  sous: string;
}[] = [
  {
    id: 'cms',
    titre: 'Sites & CMS',
    sous: 'Wix, Webflow, WordPress — bloc HTML / Embed',
  },
  {
    id: 'metier',
    titre: 'Logiciels immobiliers',
    sous: 'Netty, Apimo, La Boîte Immo — zone HTML du site agence',
  },
  {
    id: 'autre',
    titre: 'Autre',
    sous: 'Site sur mesure ou outil non listé',
  },
];

/**
 * Ce ne sont pas des connecteurs : le script est le même partout. Seul le
 * chemin pour atteindre le champ HTML change d'un éditeur à l'autre, et c'est
 * exactement là que les agences se perdent.
 */
export const PLATEFORMES: readonly PlateformeInstall[] = [
  {
    id: 'wix',
    nom: 'Wix',
    groupe: 'cms',
    ouColler: 'Ajouter › Intégrations › Code HTML (mode Code)',
    logoSrc: '/widget-wix.png',
    logoClass: 'bg-black',
    logoScale: 'md',
    intro:
      'Sur Wix, le formulaire passe par un bloc « Code HTML ». Collez les deux lignes en mode Code — pas en mode adresse web.',
    etapes: [
      'Ouvrez l’éditeur Wix, puis la page où le formulaire doit apparaître (souvent « Estimer mon bien »).',
      'Cliquez sur Ajouter (+) › Intégrations › Code HTML.',
      'Choisissez « Code » (pas « Adresse du site »), collez le code Priimo.',
      'Étirez le bloc sur toute la largeur utile. La hauteur s’ajustera ensuite.',
      'Publiez, puis ouvrez la page en navigation privée pour vérifier.',
    ],
    notes: [
      'Le domaine Wix doit être déclaré dans Domaines autorisés, sinon le bloc reste vide.',
      'Ne collez pas le code dans Réglages › Code personnalisé (en-tête) : il doit être dans le corps de la page.',
    ],
  },
  {
    id: 'webflow',
    nom: 'Webflow',
    groupe: 'cms',
    ouColler: 'Designer › Embed (composant)',
    logoSrc: '/widget-webflow.png',
    logoClass: 'bg-[#0B0B0F]',
    logoScale: 'sm',
    intro:
      'Dans Webflow, un élément Embed accueille le script. Le rendu complet n’apparaît qu’après publication.',
    etapes: [
      'Ouvrez la page dans le Designer.',
      'Add (A) › Embed : glissez l’élément dans la section voulue.',
      'Collez le code Priimo dans l’Embed, validez.',
      'Passez la largeur de l’Embed à 100 % de sa colonne.',
      'Publiez le site, puis contrôlez l’URL publique.',
    ],
    notes: [
      'L’aperçu Designer peut rester incomplet : c’est normal.',
      'Ajoutez le domaine custom dans Domaines autorisés si besoin.',
    ],
  },
  {
    id: 'wordpress',
    nom: 'WordPress',
    groupe: 'cms',
    ouColler: 'Bloc « HTML personnalisé » (ou Elementor HTML)',
    logoSrc: '/widget-wordpress.png',
    logoClass: 'bg-[#1d2327]',
    logoScale: 'md',
    intro:
      'Sur WordPress, un bloc HTML personnalisé suffit. Même principe avec Elementor ou Divi (module Code / HTML).',
    etapes: [
      'Éditez la page dans l’admin WordPress.',
      'Ajoutez un bloc « HTML personnalisé » (Custom HTML).',
      'Collez le code Priimo, puis mettez à jour / publiez.',
      'Elementor : widget HTML. Divi : module Code.',
      'Videz le cache du site ou du CDN si le formulaire n’apparaît pas tout de suite.',
    ],
    notes: [
      'Certains plugins de sécurité bloquent les <script> : autorisez alors le script Priimo.',
      'Ce n’est pas un plugin : pas de shortcode, uniquement le HTML fourni.',
    ],
  },
  {
    id: 'netty',
    nom: 'Netty',
    groupe: 'metier',
    ouColler: 'Page site › contenu libre / HTML',
    logoSrc: null,
    mark: 'Ny',
    logoClass: 'bg-[#1B3A5F]',
    intro:
      'Les sites Netty ont en général une zone « contenu libre » ou HTML par page. C’est l’endroit pour coller Priimo.',
    etapes: [
      'Connectez-vous à l’administration Netty du site.',
      'Ouvrez (ou créez) la page d’estimation.',
      'Insérez un bloc contenu libre / HTML / code personnalisé.',
      'Collez le code Priimo, enregistrez, mettez en ligne.',
      'Vérifiez sur l’URL publique, pas seulement l’aperçu admin.',
    ],
    notes: [
      'Pas de zone HTML ? Demandez l’activation au support ou à votre chargé de compte Netty.',
      'Déclarez le domaine du site dans Domaines autorisés avant de tester.',
    ],
  },
  {
    id: 'apimo',
    nom: 'Apimo',
    groupe: 'metier',
    ouColler: 'Modèle / page › module HTML',
    logoSrc: null,
    mark: 'Ap',
    logoClass: 'bg-[#E85D04]',
    intro:
      'Sur Apimo, l’intégration se fait via un module HTML ou un champ code libre sur la page (ou le modèle) du site vitrine.',
    etapes: [
      'Ouvrez l’admin Apimo liée au site de l’agence.',
      'Éditez la page ou le modèle d’estimation.',
      'Ajoutez un module HTML / code personnalisé à l’emplacement voulu.',
      'Collez le code Priimo sans le modifier, publiez.',
      'Contrôlez l’URL publique (rafraîchissez le cache si besoin).',
    ],
    notes: [
      'Selon le pack, l’édition HTML peut être réservée à l’intégrateur : passez alors par « Confier à mon prestataire ».',
      'Le domaine Apimo ou custom doit figurer dans Domaines autorisés.',
    ],
  },
  {
    id: 'boite-immo',
    nom: 'La Boîte Immo',
    groupe: 'metier',
    ouColler: 'Gestionnaire de pages › zone HTML',
    logoSrc: null,
    mark: 'BI',
    logoClass: 'bg-[#0F766E]',
    intro:
      'Sur La Boîte Immo, collez le code dans une zone HTML / contenu libre du gestionnaire de pages du site.',
    etapes: [
      'Connectez-vous à l’espace La Boîte Immo du site.',
      'Ouvrez le gestionnaire de pages, sélectionnez ou créez la page d’estimation.',
      'Ajoutez une zone HTML / contenu libre / code.',
      'Collez le code Priimo, validez, mettez en ligne.',
      'Vérifiez en navigation privée sur le site public.',
    ],
    notes: [
      'Si aucune zone HTML n’est proposée, demandez l’activation à votre interlocuteur LBI.',
      'Ajoutez le domaine du site dans Domaines autorisés.',
    ],
  },
  {
    id: 'fait-main',
    nom: 'Site fait main',
    groupe: 'autre',
    ouColler: 'Dans le <body>, à l’emplacement du formulaire',
    logoSrc: null,
    logoClass: 'bg-[#15202F]',
    intro:
      'Aucune dépendance : collez le code dans le HTML de la page, exactement où le formulaire doit s’afficher.',
    etapes: [
      'Ouvrez le fichier ou le gabarit de la page.',
      'Placez le code dans le <body> (pas seulement dans le <head>).',
      'Déployez comme d’habitude.',
      'Vérifiez que le domaine de production est autorisé dans Priimo.',
    ],
    notes: [
      'CSP stricte : autorisez le script depuis l’origine Priimo.',
    ],
  },
];
