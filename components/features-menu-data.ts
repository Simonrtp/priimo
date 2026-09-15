import type { LucideIcon } from 'lucide-react';
import {
  Compass,
  Kanban,
  LineChart,
  MapPinned,
  Ruler,
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

const DETECTION: FeatureMenuItem = {
  title: 'Détection',
  description: 'Les adresses encore libres',
  href: '/fonctionnalites/detection',
  icon: Compass,
};

const TERRAIN: FeatureMenuItem = {
  title: 'Terrain & IA',
  description: 'Plus rien à ressaisir le soir',
  href: '/fonctionnalites/terrain',
  icon: MapPinned,
};

const PILOTAGE: FeatureMenuItem = {
  title: 'Pilotage commercial',
  description: 'Des chiffres sans saisie',
  href: '/fonctionnalites/pilotage',
  icon: LineChart,
};

const PIPELINE: FeatureMenuItem = {
  title: 'Pipeline & CRM',
  description: 'Le mandat comme suite du terrain',
  href: '/fonctionnalites/pipeline',
  icon: Kanban,
};

const ESTIMATION: FeatureMenuItem = {
  title: 'Estimation',
  description: 'Le vendeur voit d’où vient le chiffre',
  href: '/fonctionnalites/estimation',
  icon: Ruler,
};

export const FEATURE_MENU_GROUPS: FeatureMenuGroup[] = [
  {
    title: 'Détection',
    items: [DETECTION],
  },
  {
    title: 'Vos leads',
    items: [PIPELINE, PILOTAGE],
  },
  {
    title: 'Sur le terrain',
    items: [TERRAIN, ESTIMATION],
  },
];

/** Ordre des 5 pages, pour footer et nav mobile. */
export const FEATURE_PAGES_NAV: FeatureMenuItem[] = [
  DETECTION,
  TERRAIN,
  PILOTAGE,
  PIPELINE,
  ESTIMATION,
];
