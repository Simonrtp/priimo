/** Découpe de lignes pour Helvetica (WinAnsi). */

export function latin1(s: string): string {
  return s.replace(/[^\u0000-\u00FF]/g, '');
}

export function hexVersRgb(hex: string): { r: number; g: number; b: number } {
  const m = /^#([0-9A-Fa-f]{6})$/.exec(hex.trim());
  if (!m) return { r: 232, g: 116, b: 60 };
  const n = Number.parseInt(m[1]!, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function couperLignes(
  text: string,
  largeurDe: (s: string) => number,
  maxWidth: number,
): string[] {
  const clean = latin1(text).replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  const words = clean.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (largeurDe(next) <= maxWidth || !current) {
      current = next;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}
