import type { EstimationBien } from '@/lib/estimation/objet';
import type { EstimationOccupation } from '@/lib/estimation/cycle';

export type SuggestionPoint = { id: string; texte: string; sens: 'fort' | 'faible' };

/** Propositions du moteur : l'agent les valide une par une, rien n'est imposé. */
export function suggestionsPoints(input: {
  dpeClass: string | null;
  occupation: EstimationOccupation;
  bien: EstimationBien;
  floor: string | null;
  hasParking: boolean;
}): SuggestionPoint[] {
  const out: SuggestionPoint[] = [];
  const dpe = (input.dpeClass ?? '').toUpperCase();
  if (dpe === 'A' || dpe === 'B') {
    out.push({ id: 'dpe-fort', texte: `Étiquette DPE ${dpe}`, sens: 'fort' });
  }
  if (dpe === 'F' || dpe === 'G') {
    out.push({ id: 'dpe-faible', texte: `Étiquette DPE ${dpe}`, sens: 'faible' });
  }
  if (input.bien.dernierEtage && input.bien.ascenseur) {
    out.push({ id: 'dernier-etage', texte: 'Dernier étage avec ascenseur', sens: 'fort' });
  }
  const etage = (input.floor ?? '').trim().toLowerCase();
  if (etage === 'rdc' || etage === '0') {
    out.push({ id: 'rdc', texte: 'Rez-de-chaussée', sens: 'faible' });
  }
  if (input.hasParking) {
    out.push({ id: 'parking', texte: 'Place de parking', sens: 'fort' });
  }
  if (input.bien.balconTerrasse) {
    out.push({ id: 'exterieur', texte: 'Balcon ou terrasse', sens: 'fort' });
  }
  if (input.occupation === 'occupe') {
    out.push({ id: 'occupe', texte: 'Bien occupé à la vente', sens: 'faible' });
  }
  return out;
}
