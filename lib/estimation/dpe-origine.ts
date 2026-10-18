export type DpeOrigine = 'reel' | 'estime';

/**
 * Réel : étiquette ADEME trouvée pour ce bien (pas le DPE d’un autre logement
 * du même immeuble). Estimé : saisie de l’agent, ou lettre non rattachée.
 */
export function origineDpe(input: {
  dpeClass: string | null;
  propertyType: 'appartement' | 'maison' | null;
  declaree: DpeOrigine | null;
  sourceContexte: 'declare' | 'ademe' | null;
}): DpeOrigine | null {
  if (!input.dpeClass?.trim()) return null;
  if (input.declaree === 'reel' || input.declaree === 'estime') return input.declaree;
  if (input.sourceContexte === 'ademe' && input.propertyType !== 'appartement') return 'reel';
  return 'estime';
}

export function libelleOrigineDpe(origine: DpeOrigine | null): string {
  if (origine === 'reel') return 'DPE réel, trouvé à l’adresse';
  if (origine === 'estime') return 'DPE estimé';
  return 'DPE non renseigné';
}
