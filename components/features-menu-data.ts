import type { LucideIcon } from 'lucide-react';
import {
  Building2,
  CalendarCheck,
  Database,
  Lightbulb,
  ListChecks,
  MapPin,
  Share2,
  Target,
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
        description: 'Chaque adresse notée de 0 à 100',
        href: '/fonctionnalites/scoring',
        icon: Target,
      },
      {
        title: 'Signaux expliqués',
        description: 'Le pourquoi derrière chaque lead',
        href: '/fonctionnalites/scoring#signaux',
        icon: Lightbulb,
      },
      {
        title: 'Données publiques',
        description: 'DPE, DVF, BODACC, copropriétés',
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
        description: 'Les adresses prioritaires, chaque lundi',
        href: '/fonctionnalites/livraison',
        icon: CalendarCheck,
      },
      {
        title: 'Module Entreprises',
        description: 'SCI en dissolution, dirigeant identifié',
        href: '/fonctionnalites/sci',
        icon: Building2,
      },
      {
        title: 'Secteur exclusif',
        description: 'Une seule agence par zone',
        href: '/fonctionnalites/livraison#secteur',
        icon: MapPin,
      },
    ],
  },
  {
    title: 'VOTRE ÉQUIPE',
    items: [
      {
        title: 'Suivi des prospects',
        description: 'Statuts, assignation, notes',
        href: '/fonctionnalites/livraison#suivi',
        icon: ListChecks,
      },
      {
        title: 'Export et partage',
        description: 'CSV ou lien Google Maps',
        href: '/fonctionnalites/livraison#export',
        icon: Share2,
      },
    ],
  },
];
