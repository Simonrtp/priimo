import { FIELD } from '@/lib/today/field';
import type { FamilleActivite } from './types';

/**
 * Une couleur par famille d'activité : teinte pleine pour l'icône, pastille
 * très claire pour le fond.
 *
 * ÉCART ASSUMÉ vs la proposition de départ. Elle donnait terracotta #B4552F
 * aux estimations et rouge brique #A03A32 aux informations terrain : 13° de
 * teinte d'écart, indiscernables dans une pastille de 32 px. Pire, le
 * terracotta venait se poser juste à côté de l'orange lead #E8743C (20°), ce
 * qui aurait vidé de son sens la réservation de l'orange aux leads — on aurait
 * eu trois oranges chauds à l'écran dont deux non-leads.
 *
 * Correction : les estimations passent en bleu canard. C'est aussi la couleur
 * de l'étape « estimation » du pipeline (lib/queries/lead-stages.ts) : la
 * colonne kanban et le compteur d'accueil parlent de la même chose avec la même
 * teinte. Le rouge brique reste, et devient le seul rouge chaud.
 *
 * Deux valeurs de la proposition ont aussi été corrigées par la mesure, pas à
 * l'œil :
 *   - l'ocre #C08A2E ne donnait que 2,48:1 sur sa propre pastille crème, sous
 *     le seuil WCAG de 3:1 pour un élément graphique. Assombri en #A07124.
 *   - le premier bleu canard #2F7D95 tombait à 19,9° du bleu ardoise, sous le
 *     seuil de séparation de 20°. Décalé en #1F8294, à 24,8°.
 *
 * Reste à vérifier à l'œil en pastille de 32 px, dans cet ordre : bleu canard
 * contre bleu ardoise (24,8°, le couple le plus serré), puis rouge brique et
 * ocre contre l'orange lead — ils en sont à 15° et 18° de teinte et ne s'en
 * séparent que par la clarté.
 */

export type CouleurFamille = {
  /** Teinte pleine — icône, barre de progression, accent. */
  teinte: string;
  /** Teinte très claire — pastille de fond derrière l'icône. */
  pastille: string;
};

export const COULEUR_FAMILLE: Record<FamilleActivite, CouleurFamille> = {
  contacts_physiques: { teinte: '#3D5A80', pastille: '#DCE4F0' },
  immeubles_prospectes: { teinte: '#A07124', pastille: '#F5E7C9' },
  contacts_qualifies: { teinte: '#2F7A5A', pastille: '#D5EADF' },
  estimations: { teinte: '#1F8294', pastille: '#D6E9EF' },
  informations_terrain: { teinte: '#A03A32', pastille: '#F2DAD7' },
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
