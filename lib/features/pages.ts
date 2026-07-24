export type FeatureSection = {
  /** Clé stable pour piocher le texte dans les compositions de page. */
  key?: string;
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

/** Récupère une section par sa clé (texte inchangé — pour les compositions). */
export function getSection(content: FeaturePageContent, key: string): FeatureSection {
  const section = content.sections.find((s) => s.key === key);
  if (!section) throw new Error(`Section introuvable : ${key}`);
  return section;
}

export const SCORING_PAGE: FeaturePageContent = {
  meta: {
    title: 'Scoring prédictif',
    description:
      'Comment Priimo lit les signaux immobiliers — DPE, DVF, BODACC, copropriétés — pour noter chaque adresse de 0 à 100 et expliquer pourquoi.',
    path: '/fonctionnalites/scoring',
  },
  label: 'DÉTECTION',
  h1: 'Comment Priimo sait qui va vendre',
  accroche:
    'Un DPE coûte entre 100 et 250 euros. Personne ne le refait par plaisir. Priimo lit ce genre de signaux dans ses bases de données, et vous dit où aller.',
  sections: [
    {
      key: 'signal',
      title: 'Le signal que tout le monde a sous les yeux',
      paragraphs: [
        'Le DPE est obligatoire pour vendre ou louer, il coûte cher, il se commande des mois avant la mise en vente. Un DPE refait sur un bien qui n\'est pas à vendre, c\'est une intention qui se prépare. C\'est la base de la détection Priimo.',
      ],
    },
    {
      key: 'sources',
      id: 'sources',
      title: 'Bases de données, croisées',
      paragraphs: [
        'DPE (ADEME) : l\'intention. DVF : les ventes réelles, l\'historique, les cascades d\'immeuble. BODACC : les SCI qui se dissolvent. Registre des copropriétés : les copropriétés fragilisées. Permis de construire : les chantiers en cours. Cadastre : la localisation précise. Brutes, elles sont illisibles. Priimo les croise.',
      ],
    },
    {
      key: 'score',
      title: 'Un score, de 0 à 100',
      paragraphs: [
        'Chaque adresse est notée. Le score combine la fraîcheur du diagnostic, la pression réglementaire (loi Climat), l\'activité de l\'immeuble, la durée de détention et le contexte de la copropriété. Les meilleures adresses remontent.',
      ],
    },
    {
      key: 'pourquoi',
      id: 'signaux',
      title: 'Le pourquoi, toujours affiché',
      paragraphs: [
        'C\'est ce qui distingue Priimo. Chaque lead arrive avec ses signaux expliqués : « DPE G refait il y a 3 semaines », « 2 ventes dans l\'immeuble cette année », « détenu depuis 9 ans ». Un score sans explication est une boîte noire — et une boîte noire ne se défend pas devant un agent. Vous savez pourquoi cette adresse est là, donc vous savez quoi dire.',
      ],
    },
    {
      key: 'verification',
      id: 'verification',
      title:
        'Un diagnostic récent ne suffit pas. Encore faut-il que le bien soit libre.',
      paragraphs: [
        'La plupart des diagnostics fraîchement réalisés correspondent à des biens déjà confiés à une agence. C\'est la raison pour laquelle une simple liste de DPE ne vaut rien.',
        'Priimo va plus loin : chaque adresse retenue est confrontée aux annonces réellement en ligne. Si le bien est en vente quelque part, il est retiré de votre liste avant livraison.',
        'Ce qui reste est l\'anomalie utile : un propriétaire qui a engagé la démarche de vente, et dont le bien n\'est apparu nulle part.',
      ],
    },
    {
      key: 'verification-comment',
      title: 'Comment',
      paragraphs: [
        'Une annonce ne publie jamais l\'adresse. Elle publie en revanche la carte d\'identité du bien : surface au mètre près, classe énergétique, classe GES, consommation, étage, localisation approchée. Le diagnostic contient la même carte d\'identité — plus l\'adresse. Priimo rapproche les deux. Quand tout concorde, le bien est déjà sur le marché.',
      ],
    },
    {
      key: 'verification-disclaimer',
      title: 'Ce que nous ne promettons pas',
      paragraphs: [
        'Un mandat confié sans publicité reste invisible. Nous affirmons l\'absence des portails au jour de la vérification, pas l\'absence de mandat.',
      ],
    },
  ],
  enClair: 'Priimo ne devine pas. Il lit des faits vérifiables, les croise, et vous montre lesquels comptent.',
};

export const SCI_PAGE: FeaturePageContent = {
  meta: {
    title: 'Module Entreprises — SCI',
    description:
      'Après le 11 août 2026, le B2B reste joignable. Priimo surveille le BODACC et vous alerte sur les SCI avec le dirigeant nommément identifié.',
    path: '/fonctionnalites/sci',
  },
  label: 'VOS LEADS',
  h1: 'Après le 11 août, il reste des propriétaires que vous pourrez encore appeler.',
  accroche:
    'Le démarchage téléphonique des particuliers sera interdit sans consentement. Une SCI est une personne morale : son dirigeant reste joignable — et, dans la grande majorité des cas, nommément identifié.',
  sections: [
    {
      key: 'dissolution',
      title: 'Une dissolution, c\'est un bien qui bouge',
      paragraphs: [
        'Une SCI qui se dissout, se liquide, ou dont les parts sont cédées : dans tous les cas, le patrimoine détenu va changer de mains. Ces événements sont publiés au BODACC, le bulletin officiel. Priimo les surveille en continu.',
      ],
    },
    {
      key: 'contact',
      title: 'Le seul lead avec un interlocuteur joignable',
      paragraphs: [
        'Pour un particulier, Priimo ne donne jamais de nom ni de téléphone : ce sont des données personnelles. Pour une société, c\'est différent. Les dirigeants et les coordonnées professionnelles figurent dans les registres légaux publics. Vous recevez donc : la société, l\'événement, le dirigeant nommément identifié, et son contact pro.',
      ],
    },
    {
      key: 'rare',
      title: 'Un signal rare, jamais rempli artificiellement',
      paragraphs: [
        'Les dissolutions ne se commandent pas. Certaines semaines il y en a trois, d\'autres aucune. Priimo ne comble jamais un quota avec des SCI faibles pour faire du volume : vous recevez celles qui existent, quand elles existent.',
      ],
    },
    {
      key: 'cadre',
      title: 'Cadre de l\'échange',
      paragraphs: [
        'L\'échange doit porter exclusivement sur la société et le bien qu\'elle détient.',
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
      'Chaque lundi, votre semaine de prospection est déjà préparée : liste courte scorée, secteur exclusif, suivi d\'équipe et export Google Maps.',
    path: '/fonctionnalites/livraison',
  },
  label: 'SUR LE TERRAIN',
  h1: 'Le lundi, votre semaine de prospection est déjà préparée.',
  accroche:
    'Une liste courte, priorisée par score, sur un secteur qui n\'appartient qu\'à vous — et de quoi la travailler à plusieurs sans jamais frapper deux fois à la même porte.',
  sections: [
    {
      key: 'liste',
      title: 'La liste du lundi',
      paragraphs: [
        'Chaque semaine, les nouvelles adresses prioritaires arrivent dans votre tableau de bord. Une liste courte, scorée : vous savez par où commencer. Nous préférons vous livrer moins d\'adresses, mais aucune qui soit déjà prise.',
      ],
    },
    {
      key: 'secteur',
      id: 'secteur',
      title: 'Votre secteur n\'appartient qu\'à vous',
      paragraphs: [
        'Une seule agence par zone. Si votre secteur est pris, il est pris. Un avantage que tout le monde possède n\'est plus un avantage.',
      ],
    },
    {
      key: 'suivi',
      id: 'suivi',
      title: 'Travailler la liste à plusieurs',
      paragraphs: [
        'Chaque adresse a un statut (nouveau, contacté, intéressé, pas intéressé), peut être assignée à un collaborateur, et reçoit des notes. Vous voyez qui a fait quoi, et où ça en est. Deux agents ne frappent jamais à la même porte.',
      ],
    },
    {
      key: 'feedback',
      title: 'Dites-nous ce que ça a donné',
      paragraphs: [
        'Pour chaque adresse travaillée, vous indiquez le résultat : mandat signé, vendeur perdu, pas vendeur, injoignable. Ce retour n\'est pas décoratif : il entraîne le moteur. Plus vous nous dites la vérité du terrain, plus les listes suivantes sont justes. C\'est la seule façon honnête de faire progresser un scoring.',
      ],
    },
    {
      key: 'export',
      id: 'export',
      title: 'Sur le terrain',
      paragraphs: [
        'Export CSV, ou lien Google Maps partagé en un clic : votre tournée de boîtage est prête. Un canal qui prend de l\'importance quand le téléphone ferme le 11 août.',
      ],
    },
  ],
  enClair: 'Priimo ne fait pas les mandats à votre place. Il vous évite de frapper aux mauvaises portes.',
};
