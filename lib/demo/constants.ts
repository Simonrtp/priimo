/** Agence test — 20e arrondissement. NE PAS utiliser pour les agences réelles. */
export const DEMO_AGENCY_ID = '34fca84a-797f-4827-8cfe-d10af156620e';

/** Profil directeur Simon sur l'agence test — pile Aujourd'hui scénarisée pour lui. */
export const DEMO_DIRECTOR_PROFILE_ID = 'eba14836-55e4-458c-97c3-7949dbb59d8d';

/** Agences réelles — le seed refuse toute écriture si la cible correspond. */
export const PROTECTED_AGENCY_PREFIXES = [
  '66e92921', // Century 21
  '82c9a5d0', // Leman Property
  '42ad4bdc', // Swixim
] as const;

export const DEMO_PASSWORD = 'DemoAgence75020!';

export type DemoNegotiatorKey = 'camille' | 'thomas' | 'lea' | 'bruno';

export type DemoNegotiatorSpec = {
  key: DemoNegotiatorKey;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  secteurLabels: string[];
  /** Part des dictées (hors directeur). */
  noteShare: number;
};

/** Quatre négociateurs fictifs — le directeur réel (Simon) n'est pas recréé. */
export const DEMO_NEGOTIATORS: DemoNegotiatorSpec[] = [
  {
    key: 'camille',
    email: 'camille.fournier.demo@example.com',
    firstName: 'Camille',
    lastName: 'Fournier',
    phone: '0639980101',
    secteurLabels: ['Gambetta', 'Pelleport', 'Ménilmontant'],
    noteShare: 0.4,
  },
  {
    key: 'thomas',
    email: 'thomas.perrin.demo@example.com',
    firstName: 'Thomas',
    lastName: 'Perrin',
    phone: '0639980202',
    secteurLabels: ['Charonne', 'Belleville'],
    noteShare: 0.25,
  },
  {
    key: 'lea',
    email: 'lea.marchand.demo@example.com',
    firstName: 'Léa',
    lastName: 'Marchand',
    phone: '0639980303',
    secteurLabels: ['Sorbier', 'Orfila'],
    noteShare: 0.18,
  },
  {
    key: 'bruno',
    email: 'bruno.delaunay.demo@example.com',
    firstName: 'Bruno',
    lastName: 'Delaunay',
    phone: '0639980404',
    secteurLabels: ['Amandiers', 'Père-Lachaise'],
    noteShare: 0.1,
  },
];

export const FICTION_PHONES = [
  '0639980505',
  '0639980606',
  '0639980707',
  '0639980808',
  '0639980909',
  '0639981010',
  '0639981111',
  '0639981212',
  '0639981313',
  '0639981414',
] as const;

export const FIRST_NAMES = [
  'Alain', 'Amélie', 'Antoine', 'Céline', 'David', 'Élodie', 'Fabien',
  'Hélène', 'Isabelle', 'Jérôme', 'Laure', 'Luc', 'Marine', 'Nicolas', 'Odile',
  'Pascal', 'René', 'Sylvie', 'Valérie', 'Yann', 'Brigitte', 'Christophe', 'Diane',
] as const;

export const LAST_NAMES = [
  'Arnaud', 'Barbier', 'Chevalier', 'Dupuis', 'Ferrand', 'Garnier', 'Hubert',
  'Jacquet', 'Klein', 'Lemoine', 'Mercier', 'Nguyen', 'Olivier', 'Perrot',
  'Rousseau', 'Simon', 'Tessier', 'Vidal', 'Weber', 'Zimmer', 'Bonnet', 'Caron',
] as const;

/** Textes de notes terrain — registre oral. */
export const NOTE_TRANSCRIPTS = [
  'Croisé la gardienne du 14, elle dit que le 3e droite se vide en septembre',
  'Madame Ferrand, son fils cherche un deux pièces, budget 380 max',
  'Boulangerie du coin, le patron dit que le propriétaire du 22 est en maison de retraite depuis mars',
  'Le gardien pense que le 5e est vacant, pas de lumière la nuit',
  'Voisine du 2e : bruit de travaux la semaine dernière, peut-être une vente',
  'SCI au nom de Leroy, trois lots dans l\'immeuble, à suivre',
  'Proprio sympa, rappeler après les vacances',
  'Pas de réponse à la porte, laissé un avis de passage',
  'Locataire part en fin de bail, fin octobre',
  'Syndic change, nouvelle gardienne plus bavarde',
] as const;
