export type FeatureCapture = {
  /** Fichier attendu dans /public/captures/ */
  file: string;
  alt: string;
  /** Consigne exacte : écran, vue, élément à cadrer. */
  shot: string;
};

export type FeatureBenefit = {
  title: string;
  body: string;
  capture: FeatureCapture;
};

export type FeatureProofItem = {
  source: string;
  fact: string;
};

export type FeatureRelated = {
  href: string;
  label: string;
  blurb: string;
};

export type FeaturePageContent = {
  slug: string;
  meta: {
    title: string;
    description: string;
    path: string;
  };
  label: string;
  h1: string;
  mecanisme: [string, string];
  benefits: FeatureBenefit[];
  proofIntro: string;
  proof: FeatureProofItem[];
  related: [FeatureRelated, FeatureRelated];
};

export const DETECTION_PAGE: FeaturePageContent = {
  slug: 'detection',
  meta: {
    title: 'Détection',
    description:
      'Priimo filtre les diagnostics déjà devenus des annonces, note chaque adresse de 0 à 100 et livre la liste à une seule agence par secteur.',
    path: '/fonctionnalites/detection',
  },
  label: 'Détection',
  h1: 'Vous n’allez que là où le bien n’est pas encore en vente.',
  mecanisme: [
    'Priimo croise des bases publiques françaises : diagnostics ADEME, ventes DVF, registre des copropriétés, cadastre IGN, BODACC. Chaque adresse reçoit un score de 0 à 100, calculé sur la fraîcheur du diagnostic et cinq signaux annexes plafonnés.',
    'Avant d’arriver dans votre tableau de bord, l’adresse est confrontée aux annonces des portails. Si le bien y figure, il sort de la liste. Ce qui reste, c’est un propriétaire qui a avancé — et un bien introuvable en ligne au jour de la vérification.',
  ],
  benefits: [
    {
      title: 'Un diagnostic récent ne vaut rien s’il est déjà une annonce.',
      body: 'La plupart des diagnostics fraîchement déposés correspondent à un bien déjà publié. Priimo rapproche la carte d’identité du diagnostic (surface, classe énergétique, étage, localisation) de celle des annonces. Quand ça concorde, l’adresse n’est pas livrée. Nous affirmons l’absence des portails à la date de vérification — pas l’absence de mandat.',
      capture: {
        file: 'detection-verification-marche.png',
        alt: 'Fiche prospect Priimo avec la mention de vérification marché et la date de contrôle.',
        shot: 'Desktop · /dashboard/prospection · ouvrir une fiche lead « hors marché » ou « vérifié absent » · cadrer l’en-tête de fiche avec le bandeau de vérification marché et la date.',
      },
    },
    {
      title: 'Le score dit par quelle porte commencer, le pourquoi dit quoi dire.',
      body: 'Chaque adresse est notée de 0 à 100. Le chiffre combine la fraîcheur du diagnostic — déjà filtré hors portails — et cinq signaux annexes plafonnés : activité de l’immeuble, durée de détention, copropriété, événements de vie, situation d’entreprise. Les signaux s’affichent en clair sur la fiche : « DPE G refait il y a trois semaines », « deux ventes dans l’immeuble cette année ». Un score sans explication ne se défend pas devant un négociateur.',
      capture: {
        file: 'detection-fiche-score-signaux.png',
        alt: 'Fiche prospect avec le score 0 à 100 et les signaux expliqués.',
        shot: 'Desktop · /dashboard/prospection · ouvrir un lead scoré · cadrer le score et le bloc de signaux expliqués (DPE, cascade, copro), sans le panneau interne des points.',
      },
    },
    {
      title: 'La liste de la semaine n’appartient qu’à votre agence.',
      body: 'Une seule agence par secteur. Les nouvelles adresses arrivent dans le tableau de bord, en liste courte, déjà scorées. Un lead non pris reste dans le lot commun de l’agence ; le prendre l’attribue et l’envoie dans le pipeline. Nous livrons moins d’adresses, et aucune qui soit déjà en ligne.',
      capture: {
        file: 'detection-nouvelles-adresses.png',
        alt: 'Bloc Mes nouvelles adresses sur l’accueil Priimo, lot de la semaine.',
        shot: 'Desktop · /dashboard · cadrer la carte « Mes nouvelles adresses » avec plusieurs leads non pris, scores visibles.',
      },
    },
    {
      title: 'Après le 11 août 2026, il reste des propriétaires que vous pouvez encore appeler.',
      body: 'Le démarchage téléphonique des particuliers sans consentement s’arrête. Une société reste une personne morale : son dirigeant figure dans les registres publics. Priimo surveille le BODACC (dissolutions, liquidations, cessions de parts) et, quand l’identité professionnelle est publiée, la pose sur la fiche. L’échange porte sur la société et le bien qu’elle détient — pas sur la vie privée du dirigeant.',
      capture: {
        file: 'detection-fiche-entreprise.png',
        alt: 'Fiche prospect entreprise avec l’événement BODACC et le dirigeant identifié.',
        shot: 'Desktop · /dashboard/prospection?vue=liste · onglet Entreprises · ouvrir une fiche SCI · cadrer l’événement BODACC, la raison sociale et le bloc dirigeant.',
      },
    },
  ],
  proofIntro:
    'Ce que Priimo lit est public. Ce qu’il ajoute, c’est le croisement, le filtre portails, et le classement.',
  proof: [
    {
      source: 'ADEME',
      fact: 'Diagnostics de performance énergétique, date et classe — le signal d’intention, une fois retiré ce qui est déjà en annonce.',
    },
    {
      source: 'DVF · DGFiP',
      fact: 'Ventes immobilières constatées : historique de l’immeuble, cascades, comparables.',
    },
    {
      source: 'Registre des copropriétés',
      fact: 'Immatriculation et état de la copropriété, pour le contexte avant de sonner.',
    },
    {
      source: 'Cadastre IGN',
      fact: 'Parcelle et localisation, pour poser l’adresse sur la carte et sur le terrain.',
    },
    {
      source: 'BODACC',
      fact: 'Dissolutions, liquidations, cessions de parts de sociétés détentrices.',
    },
  ],
  related: [
    {
      href: '/fonctionnalites/terrain',
      label: 'Terrain & IA',
      blurb: 'La liste ne sert que si elle sort. Carte, dictée, tournée.',
    },
    {
      href: '/fonctionnalites/pipeline',
      label: 'Pipeline & CRM',
      blurb: 'Une adresse prise devient un dossier, pas une ligne oubliée.',
    },
  ],
};

export const TERRAIN_PAGE: FeaturePageContent = {
  slug: 'terrain',
  meta: {
    title: 'Terrain & IA',
    description:
      'Carte cadastre, notes dictées en marchant, tournées depuis l’agence : Priimo range le terrain pendant que vous y êtes.',
    path: '/fonctionnalites/terrain',
  },
  label: 'Terrain & IA',
  h1: 'Plus rien à ressaisir le soir.',
  mecanisme: [
    'La carte pose le cadastre sous vos adresses. Un immeuble ouvre les ventes passées, la copropriété, les diagnostics — avant d’appuyer sur la sonnette.',
    'Vous dictez en marchant. Priimo rattache la note à l’adresse. La tournée se calcule depuis l’agence ; le mode sortie tient dans la poche, y compris hors réseau le temps de la file d’attente.',
  ],
  benefits: [
    {
      title: 'L’immeuble se lit avant de sonner.',
      body: 'En vue carte, les couches cadastre montrent les DPE, les ventes DVF et les copropriétés sur la parcelle. Ce n’est pas un fond de plan : c’est la même base que la fiche, posée dans la rue. Vous savez si l’immeuble a bougé, et ce que vous pouvez dire en bas d’escalier.',
      capture: {
        file: 'terrain-carte-cadastre.png',
        alt: 'Carte Priimo avec couches cadastre, DPE et ventes sur un îlot.',
        shot: 'Desktop · /dashboard/prospection?vue=carte · activer les couches DPE / ventes / copropriétés · cadrer un îlot avec pastilles et panneau parcelle ouvert.',
      },
    },
    {
      title: 'La phrase dite dans la rue est déjà classée.',
      body: '« Dicter une note » depuis le menu de création lance l’enregistrement. Au relâchement, le texte est proposé, rattaché à l’adresse ou à l’immeuble, et visible par l’équipe selon les règles de l’agence. Pas de carnet. Pas de recopie le soir au retour.',
      capture: {
        file: 'terrain-dictee-note.png',
        alt: 'Feuille de dictée vocale Priimo avec le texte proposé et l’adresse rattachée.',
        shot: 'Mobile ou desktop · menu Créer → Dicter une note · cadrer la feuille de relecture (transcription + adresse), pas l’écran d’autorisation micro.',
      },
    },
    {
      title: 'La tournée part de l’agence, pas d’un tableur.',
      body: 'Priimo trace un parcours piéton depuis le siège, sur les adresses à voir. Sur mobile, le mode sortie n’affiche que ce qu’il faut pour la porte suivante. Ce qui a été vu met à jour la fraîcheur de la zone : vous ne reconstruisez pas la tournée le lundi matin.',
      capture: {
        file: 'terrain-tournee-mobile.png',
        alt: 'Mode tournée mobile Priimo avec la prochaine adresse et l’itinéraire.',
        shot: 'Mobile · /dashboard/tournee · cadrer l’écran guidage (adresse courante, suivante, carte). Si la démo est desktop, /dashboard/prospection?vue=carte avec l’itinéraire affiché.',
      },
    },
    {
      title: 'Vous voyez où vous êtes passé, et où le secteur a vieilli.',
      body: 'Les zones de prospection découpent le territoire de l’agence. La fraîcheur se calcule sur les passages observés — pas sur une case cochée à la main. Une zone froide, c’est une zone à remettre dans la tournée, pas un sentiment.',
      capture: {
        file: 'terrain-zones-fraicheur.png',
        alt: 'Carte du secteur avec les zones colorées selon la fraîcheur de passage.',
        shot: 'Desktop · /dashboard · carte Mon secteur, ou /dashboard/prospection?vue=carte avec le calque de fraîcheur · cadrer le coloriage des zones et la légende.',
      },
    },
  ],
  proofIntro:
    'Le terrain n’est plus un angle mort du logiciel. Ce qui se passe dehors écrit dans la même base que le pipeline.',
  proof: [
    {
      source: 'Cadastre IGN',
      fact: 'Parcelles sous la carte, pour coller l’adresse au bâtiment réel.',
    },
    {
      source: 'DVF · ADEME · copropriétés',
      fact: 'Les mêmes sources que la détection, lisibles immeuble par immeuble sur la carte.',
    },
    {
      source: 'Notes vocales',
      fact: 'Enregistrement sur place, relecture, rattachement à l’adresse — file hors ligne si le réseau lâche.',
    },
  ],
  related: [
    {
      href: '/fonctionnalites/detection',
      label: 'Détection',
      blurb: 'D’où viennent les adresses que vous allez frapper.',
    },
    {
      href: '/fonctionnalites/pilotage',
      label: 'Pilotage commercial',
      blurb: 'Les passages et les prises, lus sans tableau Excel.',
    },
  ],
};

export const PILOTAGE_PAGE: FeaturePageContent = {
  slug: 'pilotage',
  meta: {
    title: 'Pilotage commercial',
    description:
      'Taux de prise, entonnoir, activité par négociateur, couverture du secteur : Priimo compte ce qui s’est passé, pas ce qu’on a saisi.',
    path: '/fonctionnalites/pilotage',
  },
  label: 'Pilotage commercial',
  h1: 'Un chiffre qui exige une saisie est un chiffre faux.',
  mecanisme: [
    'Priimo observe les prises dans le lot livré, les étapes du pipeline, les estimations ouvertes, les passages sur le secteur. Aucun de ces indicateurs n’est un champ à remplir le vendredi soir.',
    'Le directeur lit l’agence telle qu’elle a travaillé. Le négociateur lit sa propre semaine. Même base, deux profondeurs.',
  ],
  benefits: [
    {
      title: 'Vous voyez ce qui a été pris dans le lot, et ce qui dort.',
      body: 'Les leads de la semaine arrivent non attribués. Le compteur de non-pris se met à jour quand quelqu’un prend une adresse — pas quand on déclare l’avoir « travaillée ». Un lot qui stagne se lit en une ligne sur l’accueil.',
      capture: {
        file: 'pilotage-compteurs-accueil.png',
        alt: 'Compteurs d’activité de l’accueil Priimo, dont les leads non pris.',
        shot: 'Desktop · /dashboard · cadrer la rangée de compteurs (contacts physiques, immeubles, leads, estimations) et, si visible, le volume de non-pris.',
      },
    },
    {
      title: 'L’entonnoir suit des dossiers, pas des déclarations.',
      body: 'Chaque colonne du pipeline est un engagement : la fiche n’avance que si le négociateur la déplace après un vrai contact. L’entonnoir du directeur agrège ces déplacements. Il n’y a pas de case « j’ai fait du commercial » à cocher pour gonfler la courbe.',
      capture: {
        file: 'pilotage-entonnoir.png',
        alt: 'Entonnoir de conversion de l’accueil directeur Priimo.',
        shot: 'Desktop · /dashboard · compte directeur · cadrer la carte entonnoir 3D / conversion, avec les volumes par étape.',
      },
    },
    {
      title: 'L’activité d’un négociateur se lit sur ses dossiers et ses passages.',
      body: 'Contacts physiques, immeubles prospectés, notes, estimations : les compteurs partent des objets créés et des tournées faites. Le directeur peut afficher un collaborateur. Personne n’auto-évalue sa journée.',
      capture: {
        file: 'pilotage-activite-negociateur.png',
        alt: 'Accueil filtré sur un négociateur, compteurs et cartes du jour.',
        shot: 'Desktop · /dashboard · sélecteur collaborateur (directeur) · cadrer l’en-tête + compteurs du négociateur choisi.',
      },
    },
    {
      title: 'Le secteur montre où vous êtes à jour — et où ça a vieilli.',
      body: 'La fraîcheur des zones se calcule sur les passages observés. Une estimation en attente, un mandat qui ne bouge plus, une relance due : ces cartes viennent des dates du dossier, pas d’un rappel saisi à la main. Ce qui n’a pas bougé remonte tout seul.',
      capture: {
        file: 'pilotage-cartes-du-jour.png',
        alt: 'Cartes du jour sur l’accueil : relances, mandats immobiles, estimations en attente.',
        shot: 'Desktop · /dashboard · cadrer le bloc de cartes métier du jour (relance, RDV sans suite, mandat qui stagne, estimation en attente).',
      },
    },
  ],
  proofIntro:
    'Le pilotage de Priimo n’a pas de saisie dédiée. Si l’objet n’existe pas dans la base, le chiffre n’existe pas.',
  proof: [
    {
      source: 'Lot livré',
      fact: 'Prise et non-pris mesurés sur les leads réellement attribués.',
    },
    {
      source: 'Pipeline',
      fact: 'L’entonnoir agrège les étapes des fiches, pas un formulaire d’activité.',
    },
    {
      source: 'Passages',
      fact: 'Fraîcheur des zones calculée sur les tournées et les notes de terrain.',
    },
  ],
  related: [
    {
      href: '/fonctionnalites/pipeline',
      label: 'Pipeline & CRM',
      blurb: 'Là où les dossiers avancent, colonne après colonne.',
    },
    {
      href: '/fonctionnalites/terrain',
      label: 'Terrain & IA',
      blurb: 'Les passages que le pilotage compte s’écrivent ici.',
    },
  ],
};

export const PIPELINE_PAGE: FeaturePageContent = {
  slug: 'pipeline',
  meta: {
    title: 'Pipeline & CRM',
    description:
      'Pipeline par étapes, contacts typés, biens, rapprochement acquéreurs, recherche unifiée : Priimo est le dossier, pas un export vers un autre logiciel.',
    path: '/fonctionnalites/pipeline',
  },
  label: 'Pipeline & CRM',
  h1: 'Le mandat n’est plus le début du dossier. Il en est la suite.',
  mecanisme: [
    'Une adresse prise quitte le lot commun et entre dans un pipeline par étapes, jusqu’au mandat. Contacts, biens, notes, estimations : la même base que la carte et que l’accueil.',
    'La recherche du bandeau retrouve une personne, une adresse ou un mandat sans changer d’outil. Rien de ce que vous faites dehors n’attend d’être recollé ailleurs.',
  ],
  benefits: [
    {
      title: 'Chaque porte a une étape, pas une ligne dans un tableur.',
      body: 'Le kanban pose les prospects de la première approche au mandat. Déplacer une fiche, c’est enregistrer qu’il s’est passé quelque chose avec le propriétaire. L’équipe voit qui tient quoi. Deux négociateurs ne frappent pas la même porte par ignorance.',
      capture: {
        file: 'pipeline-kanban.png',
        alt: 'Vue pipeline kanban de la prospection Priimo.',
        shot: 'Desktop · /dashboard/prospection?vue=pipeline · cadrer le tableau kanban avec au moins trois colonnes peuplées.',
      },
    },
    {
      title: 'Le carnet porte un rôle : vendeur, acquéreur, locataire, gardien, commerçant.',
      body: 'Le type du contact dit ce qu’il attend de vous. Un acquéreur a des critères (secteur, budget, surface). Un gardien ou un commerçant est un relais de palier. Ce n’est pas un annuaire plat : le type décide des rapprochements et de ce que la fiche propose.',
      capture: {
        file: 'pipeline-contacts.png',
        alt: 'Liste des contacts Priimo avec les types vendeur, acquéreur, gardien.',
        shot: 'Desktop · /dashboard/contacts · cadrer la liste avec plusieurs types visibles et, si possible, une fiche acquéreur ouverte sur les critères.',
      },
    },
    {
      title: 'Le bien hérite de l’histoire : estimation, mandat, compromis, vendu.',
      body: 'Quand le mandat arrive, le dossier existe déjà — notes de palier, estimation, signaux. Les statuts du bien suivent le cycle réel. Le propriétaire reste lié à la fiche. Vous ne reconstituez pas le passé dans un second logiciel le jour de la signature.',
      capture: {
        file: 'pipeline-biens.png',
        alt: 'Liste des biens Priimo avec les statuts de mandat.',
        shot: 'Desktop · /dashboard/biens · cadrer la liste (estimation / mandat / compromis) et une fiche bien ouverte sur le statut et le propriétaire.',
      },
    },
    {
      title: 'L’acquéreur se rapproche du bien sur des critères, pas au feeling.',
      body: 'Priimo confronte secteur, budget et surface de vos acquéreurs aux biens rentrés. Quand ça correspond, une carte le dit. C’est un tri. La décision d’appeler reste la vôtre. Les échéances du dossier (promesse, relance, visite sans retour) remontent toutes seules sur l’accueil.',
      capture: {
        file: 'pipeline-rapprochement.png',
        alt: 'Signal de rapprochement acquéreur–bien dans Priimo.',
        shot: 'Desktop · /dashboard ou fiche acquéreur · cadrer une carte ou un bloc « rapprochement » avec le bien proposé et les critères (secteur, budget, surface).',
      },
    },
  ],
  proofIntro:
    'Priimo n’exporte pas le terrain vers un CRM. Le CRM, c’est la suite du terrain.',
  proof: [
    {
      source: 'Pipeline',
      fact: 'Étapes tenues par les fiches, visibles par l’équipe selon le rôle.',
    },
    {
      source: 'Contacts',
      fact: 'Cinq types métier, critères acquéreur, fusion et historique.',
    },
    {
      source: 'Recherche',
      fact: 'Barre du bandeau : adresse, personne, mandat — sans changer de page.',
    },
  ],
  related: [
    {
      href: '/fonctionnalites/pilotage',
      label: 'Pilotage commercial',
      blurb: 'L’entonnoir se nourrit de ces colonnes.',
    },
    {
      href: '/fonctionnalites/estimation',
      label: 'Estimation',
      blurb: 'Le chiffre que vous défendez chez le vendeur.',
    },
  ],
};

export const ESTIMATION_PAGE: FeaturePageContent = {
  slug: 'estimation',
  meta: {
    title: 'Estimation',
    description:
      'Comparables DVF réactualisés à l’indice Notaires-INSEE, grille de caractéristiques et rapport partageable.',
    path: '/fonctionnalites/estimation',
  },
  label: 'Estimation',
  h1: 'Le vendeur voit d’où vient le chiffre.',
  mecanisme: [
    'Les comparables viennent des ventes DVF. Ils sont réactualisés avec l’indice Notaires-INSEE. La grille de caractéristiques compare le bien au secteur — pas à une moyenne nationale.',
    'Le rapport emporte le contexte : urbanisme, risques, copropriété, statistiques INSEE. Le propriétaire le reçoit.',
  ],
  benefits: [
    {
      title: 'La fourchette s’appuie sur des ventes constatées, pas sur un barème.',
      body: 'L’atelier d’estimation part des mutations DVF du secteur, ramenées à aujourd’hui par l’indice Notaires-INSEE. Vous voyez les comparables. Vous voyez ce qui a été écarté. La fourchette se défend parce que sa matière première est publique.',
      capture: {
        file: 'estimation-comparables-dvf.png',
        alt: 'Atelier d’estimation Priimo, onglet avec les comparables DVF.',
        shot: 'Desktop · /dashboard/estimation · ouvrir une estimation aboutie · onglet Estimation · cadrer la fourchette et la liste des comparables DVF.',
      },
    },
    {
      title: 'Chaque caractéristique est lue contre le secteur.',
      body: 'Étage, standing, travaux, extérieur : la grille ne recopie pas une grille nationale. Elle compare le bien aux ventes du même secteur. L’ajustement est visible. Le négociateur peut le reprendre, il ne part pas d’une boîte noire.',
      capture: {
        file: 'estimation-grille-caracteristiques.png',
        alt: 'Grille de caractéristiques de l’estimation Priimo comparée au secteur.',
        shot: 'Desktop · même estimation · onglet Caractéristiques · cadrer la grille (lignes de critères et écart au secteur).',
      },
    },
    {
      title: 'Le contexte du bien est dans le rapport, pas dans un autre onglet à ouvrir plus tard.',
      body: 'Urbanisme, risques (Géorisques), copropriété, statistiques INSEE du quartier : le rapport que vous envoyez au propriétaire contient le même dossier que vous. Il voit le chemin. Il n’a pas à vous croire sur parole.',
      capture: {
        file: 'estimation-rapport.png',
        alt: 'Rapport d’estimation Priimo, vue propriétaire.',
        shot: 'Desktop · même estimation · onglet Rapport · cadrer la première écran du rapport (fourchette + un bloc contexte urbanisme ou risques).',
      },
    },
  ],
  proofIntro:
    'Le chiffre d’une estimation Priimo se retrace. Les sources ont un nom.',
  proof: [
    {
      source: 'DVF · DGFiP',
      fact: 'Mutations du secteur, matière première de la fourchette.',
    },
    {
      source: 'Indice Notaires-INSEE',
      fact: 'Actualisation des ventes anciennes vers le marché présent.',
    },
    {
      source: 'Géorisques · INSEE · copropriétés',
      fact: 'Risques, statistiques de quartier, état de la copropriété — dans le rapport.',
    },
  ],
  related: [
    {
      href: '/fonctionnalites/detection',
      label: 'Détection',
      blurb: 'L’adresse estimée a souvent commencé ici, avant l’annonce.',
    },
    {
      href: '/fonctionnalites/pipeline',
      label: 'Pipeline & CRM',
      blurb: 'L’estimation rejoint le dossier, puis le mandat.',
    },
  ],
};

export const FEATURE_PAGES: FeaturePageContent[] = [
  DETECTION_PAGE,
  TERRAIN_PAGE,
  PILOTAGE_PAGE,
  PIPELINE_PAGE,
  ESTIMATION_PAGE,
];

export const FEATURE_CAPTURES: FeatureCapture[] = FEATURE_PAGES.flatMap((page) =>
  page.benefits.map((b) => b.capture),
);
