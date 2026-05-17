import type { PlanCode } from '@/types/database';

export const PLAN_LABEL: Record<PlanCode, string> = {
  fondateur: 'Fondateur',
  standard: 'Standard',
  premium: 'Premium',
  reseau: 'Réseau',
};

export const PLAN_PRICE: Record<PlanCode, string> = {
  fondateur: 'Gratuit',
  standard: '199 €/mois',
  premium: '499 €/mois',
  reseau: 'Sur devis',
};

export const PLAN_LEADS_QUOTA: Record<PlanCode, number> = {
  fondateur: 15,
  standard: 30,
  premium: 60,
  reseau: 120,
};

export const PLAN_BADGE_CLASSES: Record<PlanCode, string> = {
  fondateur: 'bg-gray-100 text-gray-700',
  standard: 'bg-[#3D5A80]/15 text-[#3D5A80]',
  premium: 'bg-[#E8743C]/15 text-[#A8521F]',
  reseau: 'bg-purple-100 text-purple-700',
};
