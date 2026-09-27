import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  FileText,
  Megaphone,
  Mic,
  Radar,
} from 'lucide-react';

export type FeatureMenuItem = {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
};

export type FeatureMenuGroup = {
  title: string;
  items: FeatureMenuItem[];
};

const PROSPECTION: FeatureMenuItem = {
  title: 'Prospection intelligente',
  description: 'Savoir où frapper avant de sortir',
  href: '/fonctionnalites/detection',
  icon: Radar,
};

const DICTEE: FeatureMenuItem = {
  title: 'Dictée terrain',
  description: 'Vous parlez, c’est rangé',
  href: '/fonctionnalites/terrain',
  icon: Mic,
};

const ESTIMATIONS: FeatureMenuItem = {
  title: 'Estimations et avis de valeur',
  description: 'De la visite à l’avis, sans quitter l’appli',
  href: '/fonctionnalites/estimation',
  icon: FileText,
};

const DIFFUSION: FeatureMenuItem = {
  title: 'Diffusion des mandats',
  description: 'Un mandat, tous les portails',
  href: '/fonctionnalites/pipeline',
  icon: Megaphone,
};

const PILOTAGE: FeatureMenuItem = {
  title: 'Pilotage commercial',
  description: 'Des chiffres mesurés, pas déclarés',
  href: '/fonctionnalites/pilotage',
  icon: BarChart3,
};

export const FEATURE_MENU_GROUPS: FeatureMenuGroup[] = [
  {
    title: 'Prospection',
    items: [PROSPECTION],
  },
  {
    title: 'Terrain',
    items: [DICTEE, ESTIMATIONS],
  },
  {
    title: 'Suite du mandat',
    items: [DIFFUSION, PILOTAGE],
  },
];

/** Ordre des 5 pages (= onglets landing). */
export const FEATURE_PAGES_NAV: FeatureMenuItem[] = [
  PROSPECTION,
  DICTEE,
  ESTIMATIONS,
  DIFFUSION,
  PILOTAGE,
];
