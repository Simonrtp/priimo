export type FeatureSection = {
  id?: string;
  title: string;
  paragraphs: string[];
};

export type FeaturePageContent = {
  meta: {
    title: string;
    description: string;
    path: string;
  };
  label: string;
  h1: string;
  accroche: string;
  sections: FeatureSection[];
  enClair: string;
};

export const SCORING_PAGE: FeaturePageContent = {
  meta: {
    title: 'Scoring prédictif',
    description:
      'Comment Priimo lit les signaux publics — DPE, DVF, BODACC, copropriétés — pour noter chaque adresse de 0 à 100 et expliquer pourquoi.',
    path: '/fonctionnalites/scoring',
  },
  label: 'DÉTECTION',
  h1: 'Comment Priimo sait qui va vendre',
  accroche:
    'Un DPE coûte entre 100 et 250 euros. Personne ne le refait par plaisir. Priimo lit ce genre de signaux dans les données publiques, et vous dit où aller.',
  sections: [
    {
      title: 'Le signal que tout le monde a sous les yeux',
      paragraphs: [
        'Le DPE est obligatoire pour vendre ou louer, il coûte cher, il se commande des mois avant la mise en vente. Un DPE refait sur un bien qui n\'est pas à vendre, c\'est une intention qui se prépare. C\'est la base de la détection Priimo.',
      ],
    },
    {
      id: 'sources',
      title: 'Cinq bases publiques, croisées',
      paragraphs: [
        'DPE (ADEME) : l\'intention. DVF : les ventes réelles, l\'historique, les cascades d\'immeuble. BODACC : les SCI qui se dissolvent. Registre des copropriétés : les copropriétés fragilisées. Permis de construire : les chantiers en cours. Toutes publiques, toutes gratuites, toutes illisibles brutes. Priimo les croise.',
      ],
    },
    {
      title: 'Un score, de 0 à 100',
      paragraphs: [
        'Chaque adresse est notée. Le score combine la fraîcheur du diagnostic, la pression réglementaire (loi Climat), l\'activité de l\'immeuble, la durée de détention et le contexte de la copropriété. Les meilleures adresses remontent.',
      ],
    },
    {
      id: 'signaux',
      title: 'Le pourquoi, toujours affiché',
      paragraphs: [
        'C\'est ce qui distingue Priimo. Chaque lead arrive avec ses signaux expliqués : « DPE G refait il y a 3 semaines », « 2 ventes dans l\'immeuble cette année », « détenu depuis 9 ans ». Un score sans explication est une boîte noire — et une boîte noire ne se défend pas devant un agent. Vous savez pourquoi cette adresse est là, donc vous savez quoi dire.',
      ],
    },
  ],
  enClair: 'Priimo ne devine pas. Il lit des faits publics, les croise, et vous montre lesquels comptent.',
};

export const SCI_PAGE: FeaturePageContent = {
  meta: {
    title: 'Module Entreprises — SCI',
    description:
      'Dissolutions, liquidations et cessions de parts : Priimo surveille le BODACC et vous alerte sur les SCI avec le dirigeant et son contact professionnel.',
    path: '/fonctionnalites/sci',
  },
  label: 'VOS LEADS',
  h1: 'Les SCI : le gisement de mandats que personne ne regarde',
  accroche:
    'Quand une SCI se dissout, un patrimoine immobilier va être partagé. C\'est public, c\'est daté — et c\'est le seul lead où nous pouvons vous donner un contact direct.',
  sections: [
    {
      title: 'Une dissolution, c\'est un bien qui bouge',
      paragraphs: [
        'Une SCI qui se dissout, se liquide, ou dont les parts sont cédées : dans tous les cas, le patrimoine détenu va changer de mains. Ces événements sont publiés au BODACC, le bulletin officiel. Priimo les surveille en continu.',
      ],
    },
    {
      title: 'Le seul lead avec un contact',
      paragraphs: [
        'Pour un particulier, Priimo ne donne jamais de nom ni de téléphone : ce sont des données personnelles. Pour une société, c\'est différent. Les dirigeants et les coordonnées professionnelles figurent dans les registres légaux publics. Vous recevez donc : la société, l\'événement, le dirigeant, et son contact pro.',
      ],
    },
    {
      title: 'Un signal rare, jamais rempli artificiellement',
      paragraphs: [
        'Les dissolutions ne se commandent pas. Certaines semaines il y en a trois, d\'autres aucune. Priimo ne comble jamais un quota avec des SCI faibles pour faire du volume : vous recevez celles qui existent, quand elles existent.',
      ],
    },
  ],
  enClair:
    'Pendant que vos concurrents attendent l\'annonce, la SCI est déjà en train de se dissoudre — et c\'est écrit noir sur blanc au Journal officiel.',
};

export const LIVRAISON_PAGE: FeaturePageContent = {
  meta: {
    title: 'Liste hebdomadaire et suivi',
    description:
      'Chaque lundi, une liste courte sur votre secteur exclusif. Statuts, assignation, notes, retours terrain et export CSV ou Google Maps.',
    path: '/fonctionnalites/livraison',
  },
  label: 'VOTRE ÉQUIPE',
  h1: 'Chaque lundi, la liste. Le reste de la semaine, le terrain.',
  accroche:
    'Une liste courte, expliquée, sur un secteur qui n\'appartient qu\'à vous — et de quoi la travailler à plusieurs sans rien perdre.',
  sections: [
    {
      title: 'La liste du lundi',
      paragraphs: [
        'Chaque semaine, les nouvelles adresses prioritaires arrivent dans votre tableau de bord. Une liste courte : les meilleures, pas toutes. Nous ne promettons pas de volume — un outil qui promet trente prospects et en livre cinq de qualité, ça s\'appelle une déception.',
      ],
    },
    {
      id: 'secteur',
      title: 'Votre secteur n\'appartient qu\'à vous',
      paragraphs: [
        'Une seule agence par zone. Si votre secteur est pris, il est pris. Un avantage que tout le monde possède n\'est plus un avantage.',
      ],
    },
    {
      id: 'suivi',
      title: 'Travailler la liste à plusieurs',
      paragraphs: [
        'Chaque adresse a un statut (nouveau, contacté, intéressé, pas intéressé), peut être assignée à un collaborateur, et reçoit des notes. Vous voyez ce qui a été fait, par qui, et ce qui reste. Rien ne se perd entre deux carnets.',
      ],
    },
    {
      title: 'Dites-nous ce que ça a donné',
      paragraphs: [
        'Pour chaque adresse travaillée, vos agents indiquent le résultat : mandat signé, vendeur perdu, pas vendeur, injoignable. Ce retour n\'est pas décoratif : il entraîne le moteur. Plus vous nous dites la vérité du terrain, plus les listes suivantes sont justes. C\'est la seule façon honnête de faire progresser un scoring.',
      ],
    },
    {
      id: 'export',
      title: 'Sur le terrain',
      paragraphs: [
        'Export CSV, ou lien Google Maps partagé directement avec l\'agent qui part en tournée. Vos adresses dans sa poche.',
      ],
    },
  ],
  enClair: 'Priimo ne remplace pas vos agents. Il leur évite de frapper aux mauvaises portes.',
};
