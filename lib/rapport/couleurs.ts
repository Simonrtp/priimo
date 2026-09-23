/**
 * Identité visuelle de l’avis de valeur (maquette David Valor / v2).
 * Deux couleurs d’agence, choisies parmi des nuanciers — pas un spectre libre.
 */

export const ACCENT_DEFAUT = '#14AED6';
export const ACCENT2_DEFAUT = '#1F6FB5';

export const NUANCIER_ACCENT = [
  { hex: '#14AED6', label: 'Cyan' },
  { hex: '#E8743C', label: 'Orange' },
  { hex: '#2FA37A', label: 'Vert' },
  { hex: '#8E3B5C', label: 'Bordeaux' },
  { hex: '#2A6F97', label: 'Bleu pétrole' },
  { hex: '#C45C26', label: 'Terracotta' },
  { hex: '#5B4B8A', label: 'Violet' },
  { hex: '#0F766E', label: 'Émeraude' },
] as const;

export const NUANCIER_ACCENT2 = [
  { hex: '#1F6FB5', label: 'Bleu' },
  { hex: '#2A3F7A', label: 'Marine' },
  { hex: '#3D5A80', label: 'Ardoise' },
  { hex: '#0A0D11', label: 'Encre' },
  { hex: '#1A365D', label: 'Nuit' },
  { hex: '#134E4A', label: 'Sapin' },
] as const;

export const GRAPH_ORANGE = '#F7931E';
export const GRAPH_GREEN = '#6BB02E';
export const GRAPH_PURPLE = '#4B2E83';
export const GRAPH_RED = '#F0445A';

function hexValide(raw: string | null | undefined): string | null {
  const s = raw?.trim() ?? '';
  if (/^#[0-9A-Fa-f]{6}$/.test(s)) return s.toUpperCase();
  return null;
}

export function normaliserAccent(raw: string | null | undefined): string {
  return hexValide(raw) ?? ACCENT_DEFAUT;
}

export function normaliserAccent2(raw: string | null | undefined): string {
  return hexValide(raw) ?? ACCENT2_DEFAUT;
}

export const TITRES_AVIS: Record<string, { bold: string; light: string }> = {
  'Votre bien': { bold: 'Votre', light: 'bien' },
  'Description du bien': { bold: 'Votre', light: 'bien' },
  'L’immeuble et l’appartement': { bold: 'L’immeuble', light: 'et son environnement' },
  'Le secteur': { bold: 'Les prix', light: 'dans votre quartier' },
  'Points d’intérêt': { bold: 'L’immeuble', light: 'et son environnement' },
  Connectivité: { bold: 'Les prix', light: 'dans votre quartier' },
  'Permis de construire': { bold: 'L’immeuble', light: 'et son environnement' },
  'Ventes comparables': { bold: 'Les ventes', light: 'comparables' },
  'Étude concurrentielle': { bold: 'Les biens en vente', light: 'autour de vous' },
  'Indices du marché': { bold: 'Les prix', light: 'dans votre quartier' },
  'Notre estimation': { bold: 'Notre', light: 'estimation' },
  'Prochaine étape': { bold: 'Prochaine', light: 'étape' },
};

export function decouperTitre(titre: string | undefined): { bold: string; light: string } {
  if (!titre?.trim()) return { bold: 'Avis', light: 'de valeur' };
  const connu = TITRES_AVIS[titre];
  if (connu) return connu;
  const parts = titre.trim().split(/\s+/);
  if (parts.length === 1) return { bold: parts[0]!, light: '' };
  return { bold: parts[0]!, light: parts.slice(1).join(' ') };
}
