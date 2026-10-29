import type { Zone } from './types';

/** Un secteur tracé à la rue ou au code postal dit lui-même où chercher ; un contour, non. */
export function codesDuSecteur(secteur: Zone | null, codesAgence: readonly string[]): string[] {
  if (!secteur) return [...codesAgence];
  const codesRegles: string[] = [];
  let contour = false;
  for (const regle of secteur.regles) {
    if (!regle.inclusion) continue;
    if (regle.type === 'polygone') contour = true;
    if (regle.type === 'code_postal' || regle.type === 'voie') codesRegles.push(regle.valeur.code_postal.trim());
  }
  const valides = codesRegles.filter((c) => /^\d{5}$/.test(c));
  if (!contour && valides.length > 0) return [...new Set(valides)];
  return [...new Set([...codesAgence, ...valides])];
}
