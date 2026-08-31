/**
 * Fiche adresse « wow » pour l’étape lead de la prise en main.
 *
 * L’adresse vient du secteur (ou d’un lead réel non pris) ; les signaux
 * affichés sont volontairement riches pour montrer la valeur perçue.
 */

import type { OnboardingLeadPropose } from '@/lib/queries/agent-onboarding';
import type { Lead } from '@/types/lead';

export const ONBOARDING_SHOWCASE_ID = 'onboarding-showcase';

const RUES_SECTEUR = [
  'rue Paul Meurice',
  'avenue Gambetta',
  'rue des Pyrénées',
  'rue de Belleville',
  'rue du Retrait',
] as const;

/** Signaux denses — démo onboarding, pas une extraction fidèle du dossier. */
const FAITS_SHOWCASE = [
  'Diagnostic récent — classe E (72 kWh/m²/an)',
  'Copropriété 24 lots · AG travaux votée en 2024',
  'Succession ouverte depuis 8 mois',
  '2 ventes dans l’immeuble ces 5 dernières années',
  'Bien détenu par une SCI depuis 2018',
] as const;

function villePourCodePostal(cp: string): string {
  if (cp.startsWith('75')) return 'Paris';
  if (cp.startsWith('69')) return 'Lyon';
  if (cp.startsWith('13')) return 'Marseille';
  if (cp.startsWith('31')) return 'Toulouse';
  if (cp.startsWith('33')) return 'Bordeaux';
  if (cp.startsWith('59')) return 'Lille';
  if (cp.startsWith('44')) return 'Nantes';
  return '';
}

function adressePlausible(numero: number, rue: string, cp: string): string {
  const ville = villePourCodePostal(cp);
  return ville ? `${numero} ${rue} ${cp} ${ville}` : `${numero} ${rue} ${cp}`;
}

export function isOnboardingShowcaseLead(id: string): boolean {
  return id === ONBOARDING_SHOWCASE_ID || id.startsWith(`${ONBOARDING_SHOWCASE_ID}-`);
}

function enrichirShowcase(
  base: Pick<
    OnboardingLeadPropose,
    'id' | 'address' | 'city' | 'postalCode' | 'score' | 'propertyType' | 'surfaceM2'
  >,
): OnboardingLeadPropose {
  return {
    ...base,
    score: Math.max(base.score, 93),
    mainSignalLabel: 'Succession ouverte',
    accroche: 'SCI Fradan · T3 de 72 m² au 4e',
    faits: [...FAITS_SHOWCASE],
    horsMarche: true,
  };
}

/**
 * Une adresse du secteur, toujours avec une fiche très chargée.
 * Si un lead réel non pris existe, on garde son id (ajout au suivi possible).
 */
export function leadShowcasePourOnboarding(
  codesPostaux: readonly string[],
  realLeads: readonly Lead[] = [],
): OnboardingLeadPropose[] {
  const cp = codesPostaux.find(Boolean) ?? '75020';
  const meilleur = realLeads
    .filter((lead) => lead.assignedTo == null && lead.stageId == null)
    .sort((a, b) => b.score - a.score)[0];

  const base = meilleur
    ? {
        id: meilleur.id,
        address: meilleur.address,
        city: meilleur.city,
        postalCode: meilleur.postalCode,
        score: meilleur.score,
        propertyType: meilleur.propertyType,
        surfaceM2: meilleur.surfaceM2,
      }
    : {
        id: ONBOARDING_SHOWCASE_ID,
        address: adressePlausible(12, RUES_SECTEUR[0]!, cp),
        city: villePourCodePostal(cp) || null,
        postalCode: cp,
        score: 93,
        propertyType: 'Appartement',
        surfaceM2: 72,
      };

  return [enrichirShowcase(base)];
}
