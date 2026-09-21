import type { EstimationObjet } from '@/lib/estimation/objet';

export const ETAPES_ATELIER = [
  { id: 'client', label: 'Client' },
  { id: 'bien', label: 'Le bien' },
  { id: 'caracteristiques', label: 'Caractéristiques' },
  { id: 'estimation', label: 'Estimation' },
  { id: 'rapport', label: 'Rapport' },
] as const;

export type EtapeAtelierId = (typeof ETAPES_ATELIER)[number]['id'];

export function indexEtape(id: EtapeAtelierId): number {
  return ETAPES_ATELIER.findIndex((e) => e.id === id);
}

export function etapeClientOk(e: Pick<EstimationObjet, 'contactId'>): boolean {
  return Boolean(e.contactId);
}

export function etapeBienOk(
  e: Pick<EstimationObjet, 'address' | 'propertyType' | 'surfaceM2' | 'rooms'>,
): boolean {
  return Boolean(e.address?.trim() && e.propertyType && e.surfaceM2 && e.rooms);
}

export function etapeEstimationOk(e: Pick<EstimationObjet, 'priceValue'>): boolean {
  return e.priceValue != null;
}

export function etapeRapportOk(
  e: Pick<EstimationObjet, 'contactId' | 'address' | 'propertyType' | 'surfaceM2' | 'rooms' | 'priceValue'>,
): boolean {
  return etapeClientOk(e) && etapeBienOk(e) && etapeEstimationOk(e);
}

export function manquesEtape(e: EstimationObjet, id: EtapeAtelierId): string | null {
  if (id === 'client' && !etapeClientOk(e)) {
    return 'Rattachez ou créez un client pour continuer.';
  }
  if (id === 'bien' && !etapeBienOk(e)) {
    return 'Indiquez l’adresse, le type, la surface et le nombre de pièces.';
  }
  if (id === 'estimation' && !etapeEstimationOk(e)) {
    return 'Calculez la valeur pour continuer.';
  }
  if (id === 'rapport' && !etapeRapportOk(e)) {
    return 'Terminez le client, le bien et l’estimation avant le rapport.';
  }
  return null;
}

/** Plus loin qu’on peut aller d’après ce qui est déjà en base. */
export function indexDepuisDonnees(e: EstimationObjet): number {
  if (!etapeClientOk(e)) return 0;
  if (!etapeBienOk(e)) return 1;
  if (!etapeEstimationOk(e)) return 2;
  return 4;
}

export function indexMaxAccessible(e: EstimationObjet, atteint: number): number {
  return Math.max(indexDepuisDonnees(e), atteint, 0);
}

export function etapeAccessible(
  e: EstimationObjet,
  atteint: number,
  id: EtapeAtelierId,
): boolean {
  if (id === 'rapport') return etapeRapportOk(e);
  return indexEtape(id) <= indexMaxAccessible(e, atteint);
}

/** Nouvelle estimation : toujours le client. Une fiche déjà avancée reprend où elle en est. */
export function etapeInitiale(e: EstimationObjet): EtapeAtelierId {
  if (!etapeClientOk(e)) return 'client';
  if (!etapeBienOk(e)) return 'bien';
  if (!etapeEstimationOk(e)) return 'caracteristiques';
  return 'estimation';
}
