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

/** Où coller le code, plateforme par plateforme. */
export type PlateformeInstall = {
  id: string;
  nom: string;
  etapes: string[];
};

/**
 * Ce ne sont pas des connecteurs : le script est le même partout. Seul le
 * chemin pour atteindre le champ HTML change d'un éditeur à l'autre, et c'est
 * exactement là que les agences se perdent.
 */
export const PLATEFORMES: readonly PlateformeInstall[] = [
  {
    id: 'wordpress',
    nom: 'WordPress',
    etapes: [
      'Ouvrez la page où doit apparaître le formulaire, en mode édition.',
      'Ajoutez un bloc « HTML personnalisé » à l’endroit voulu.',
      'Collez le code dans le bloc, puis mettez la page à jour.',
    ],
  },
  {
    id: 'webflow',
    nom: 'Webflow',
    etapes: [
      'Ouvrez la page dans le Designer.',
      'Glissez un élément « Embed » (Add › Components › Embed) dans la section voulue.',
      'Collez le code, enregistrez, puis publiez le site.',
    ],
  },
  {
    id: 'wix',
    nom: 'Wix',
    etapes: [
      'Dans l’éditeur, cliquez sur Ajouter › Intégrations › Code HTML.',
      'Choisissez « Code » plutôt que « Adresse du site », puis collez le code.',
      'Étirez le bloc sur toute la largeur souhaitée et publiez.',
    ],
  },
  {
    id: 'logiciel-metier',
    nom: 'Netty, Hektor, La Boîte Immo',
    etapes: [
      'Ouvrez la page depuis l’administration de votre site.',
      'Utilisez une zone « contenu libre », « HTML » ou « code personnalisé ».',
      'Collez le code et enregistrez. Si aucune zone HTML n’existe, demandez-la à votre éditeur.',
    ],
  },
  {
    id: 'fait-main',
    nom: 'Site fait main',
    etapes: [
      'Ouvrez le fichier ou le gabarit de la page concernée.',
      'Collez le code dans le <body>, à l’endroit exact où le formulaire doit s’afficher.',
      'Déployez. Aucune dépendance ni build à prévoir.',
    ],
  },
];
