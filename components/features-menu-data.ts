import type { LucideIcon } from 'lucide-react';
import {
  Building2,
  CalendarDays,
  ClipboardList,
  Database,
  Gauge,
  MapPinned,
  Share2,
  ShieldCheck,
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
        description: 'Par quelle porte commencer',
        href: '/fonctionnalites/scoring',
        icon: Gauge,
      },
      {
        title: 'Signaux expliqués',
        description: 'Quoi dire en arrivant',
        href: '/fonctionnalites/scoring#signaux',
        icon: Sparkles,
      },
      {
        title: 'Vérification marché',
        description: 'Aucune adresse déjà en vente',
        href: '/fonctionnalites/scoring#verification',
        icon: ShieldCheck,
      },
      {
        title: 'Sources croisées',
        description: 'DPE, DVF, BODACC, cadastre, copropriétés',
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
        description: 'Votre semaine prête chaque lundi',
        href: '/fonctionnalites/livraison',
        icon: CalendarDays,
      },
      {
        title: 'Module Entreprises',
        description: 'Un interlocuteur joignable après le 11 août',
        href: '/fonctionnalites/sci',
        icon: Building2,
      },
      {
        title: 'Secteur exclusif',
        description: 'Livré à vous seul',
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
        description: 'Qui a fait quoi, où ça en est',
        href: '/fonctionnalites/livraison#suivi',
        icon: ClipboardList,
      },
      {
        title: 'Export et partage',
        description: 'Vos tournées préparées',
        href: '/fonctionnalites/livraison#export',
        icon: Share2,
      },
    ],
  },
];
