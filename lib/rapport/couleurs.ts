/**
 * Identité visuelle de l’avis de valeur (maquette David Valor / v2).
 * Deux couleurs d’agence : n’importe quel hex, nuanciers proposés en raccourci.
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
  { hex: '#1A2A56', label: 'Priimo' },
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

export function hexVersHsv(hex: string): { h: number; s: number; v: number } {
  const valide = hexValide(hex) ?? ACCENT_DEFAUT;
  const r = parseInt(valide.slice(1, 3), 16) / 255;
  const g = parseInt(valide.slice(3, 5), 16) / 255;
  const b = parseInt(valide.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : d / max, v: max };
}

export function hsvVersHex(h: number, s: number, v: number): string {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) {
    r = c;
    g = x;
  } else if (h < 120) {
    r = x;
    g = c;
  } else if (h < 180) {
    g = c;
    b = x;
  } else if (h < 240) {
    g = x;
    b = c;
  } else if (h < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }
  const to = (n: number) =>
    Math.round((n + m) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`.toUpperCase();
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
