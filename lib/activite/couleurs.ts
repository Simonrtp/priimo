import { FIELD } from '@/lib/today/field';
import type { FamilleActivite } from './types';

/**
 * Une couleur par famille d'activité : teinte saturée pour l'icône et la
 * barre, pastille claire pour le fond. Pas de violet (réservé à l'entonnoir).
 * L'orange lead #E8743C reste hors de cette palette.
 */

export type CouleurFamille = {
  /** Teinte pleine — icône, barre de progression, accent. */
  teinte: string;
  /** Teinte très claire — pastille de fond derrière l'icône. */
  pastille: string;
  /** Lavis de la carte — assez saturé pour qu’on voie la famille tout de suite. */
  fond: string;
};

export const COULEUR_FAMILLE: Record<FamilleActivite, CouleurFamille> = {
  contacts_physiques: { teinte: '#1F6FE0', pastille: '#DCEBFF', fond: '#BFD6FF' },
  immeubles_prospectes: { teinte: '#B07700', pastille: '#FFE9A3', fond: '#FFE08C' },
  contacts_qualifies: { teinte: '#0F8F4A', pastille: '#C6F6D6', fond: '#9EF0B8' },
  estimations: { teinte: '#08849C', pastille: '#C8F4FA', fond: '#9BE7F2' },
  informations_terrain: { teinte: '#D61F3A', pastille: '#FFD0D6', fond: '#FFB6C0' },
};

/** L'orange produit reste aux leads. Aucune famille ne doit s'en approcher. */
export const ORANGE_LEAD = FIELD.orange;

export type Rgb = { r: number; g: number; b: number };

export function hexToRgb(hex: string): Rgb {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw new Error(`Couleur invalide : ${hex}`);
  const n = Number.parseInt(m[1]!, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/** Teinte en degrés (0–360). Sert à vérifier qu'aucune famille n'est violette. */
export function teinteDegres(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const [rn, gn, bn] = [r / 255, g / 255, b / 255];
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  if (d === 0) return 0;
  let h: number;
  if (max === rn) h = ((gn - bn) / d) % 6;
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  h *= 60;
  return h < 0 ? h + 360 : h;
}

/** Écart de teinte le plus court sur le cercle chromatique. */
export function ecartTeinte(a: string, b: string): number {
  const d = Math.abs(teinteDegres(a) - teinteDegres(b)) % 360;
  return d > 180 ? 360 - d : d;
}

function canalLineaire(v: number): number {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function luminanceRelative(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  return (
    0.2126 * canalLineaire(r) + 0.7152 * canalLineaire(g) + 0.0722 * canalLineaire(b)
  );
}

/** Rapport de contraste WCAG entre deux couleurs (1 à 21). */
export function contraste(a: string, b: string): number {
  const la = luminanceRelative(a);
  const lb = luminanceRelative(b);
  const [clair, sombre] = la >= lb ? [la, lb] : [lb, la];
  return (clair + 0.05) / (sombre + 0.05);
}

/** Plage de teintes considérée comme violette — interdite sur le terrain. */
export const VIOLET_MIN = 255;
export const VIOLET_MAX = 320;

export function estViolet(hex: string): boolean {
  const h = teinteDegres(hex);
  return h >= VIOLET_MIN && h <= VIOLET_MAX;
}
