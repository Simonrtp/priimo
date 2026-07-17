import type { LucideIcon } from 'lucide-react';
import {
  Building2,
  CalendarDays,
  ClipboardList,
  Database,
  Gauge,
  MapPinned,
  Share2,
  Sparkles,
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

export const FEATURE_MENU_GROUPS: FeatureMenuGroup[] = [
  {
    title: 'DÉTECTION',
    items: [
      {
        title: 'Scoring prédictif',
        description: 'Score de 0 à 100',
        href: '/fonctionnalites/scoring',
        icon: Gauge,
      },
      {
        title: 'Signaux expliqués',
        description: 'Le pourquoi de chaque lead',
        href: '/fonctionnalites/scoring#signaux',
        icon: Sparkles,
      },
      {
        title: 'Bases de données',
        description: 'DPE, DVF, BODACC, données privées',
        href: '/fonctionnalites/scoring#sources',
        icon: Database,
      },
    ],
  },
  {
    title: 'VOS LEADS',
    items: [
      {
        title: 'Liste hebdomadaire',
        description: 'Priorités chaque lundi',
        href: '/fonctionnalites/livraison',
        icon: CalendarDays,
      },
      {
        title: 'Module Entreprises',
        description: 'SCI, dirigeant identifié',
        href: '/fonctionnalites/sci',
        icon: Building2,
      },
      {
        title: 'Secteur exclusif',
        description: 'Une agence par zone',
        href: '/fonctionnalites/livraison#secteur',
        icon: MapPinned,
      },
    ],
  },
  {
    title: 'SUR LE TERRAIN',
    items: [
      {
        title: 'Suivi des prospects',
        description: 'Statuts et notes',
        href: '/fonctionnalites/livraison#suivi',
        icon: ClipboardList,
      },
      {
        title: 'Export et partage',
        description: 'CSV ou Google Maps',
        href: '/fonctionnalites/livraison#export',
        icon: Share2,
      },
    ],
  },
];
