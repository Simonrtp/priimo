import type { LeadStage, LeadStatus } from '@/types/lead';

/**
 * Une couleur par état, jamais partagée.
 * Pas de regroupement « tout le pipeline en bleu ».
 */
export const COULEUR_ETAPE: Record<string, string> = {
  pris: '#3D5A80',
  contacte: '#E8743C',
  rendez_vous: '#C9A227',
  estimation: '#1F8294',
  mandat: '#2E7D5B',
  perdu: '#C4483C',
};

export const COULEUR_STATUT: Record<LeadStatus, string> = {
  nouveau: '#3D5A80',
  contacte: '#E8743C',
  interesse: '#1F8294',
  mandat_signe: '#2E7D5B',
  pas_interesse: '#6B7280',
  vendeur_ailleurs: '#9A3412',
};

const EXTRA = ['#7B9AC0', '#C25E2C', '#5B8A72', '#8B5E3C', '#4A7C8C', '#A65D57'] as const;

function hashCle(cle: string): number {
  let h = 0;
  for (let i = 0; i < cle.length; i += 1) h = (h * 31 + cle.charCodeAt(i)) >>> 0;
  return h;
}

export function couleurEtatPipeline(
  stage: Pick<LeadStage, 'cle' | 'type'> | null | undefined,
): string {
  if (!stage) return '#6B7280';
  const connu = COULEUR_ETAPE[stage.cle];
  if (connu) return connu;
  return EXTRA[hashCle(stage.cle) % EXTRA.length];
}
