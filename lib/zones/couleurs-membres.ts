/**
 * Une couleur par collaborateur, unique dans l'agence : toutes ses parcelles
 * la portent, avec ses initiales. Pur.
 *
 * Douze teintes écartées d'environ 26° sur le cercle chromatique, clair et
 * foncé en alternance pour que deux voisines se distinguent encore. Deux
 * plages sont exclues : l'orange des annonces et des leads (#E8743C) et le
 * bleu de l'IA (#6366F1). Au-delà de douze, on décale la teinte jusqu'à
 * trouver une couleur libre.
 */

export const COULEURS_MEMBRES = [
  '#3B8DBA', // bleu
  '#319B64', // vert
  '#BA3B78', // framboise
  '#76319B', // violet
  '#BA9A3B', // moutarde
  '#319B92', // canard
  '#BA3B41', // rouge brique
  '#5A9B31', // vert pomme
  '#BA3BAF', // orchidée
  '#319B36', // vert prairie
  '#A3BA3B', // anis
  '#5B6B7C', // ardoise
] as const;

/** Gris des secteurs sans titulaire. */
export const COULEUR_SANS_TITULAIRE = '#8A9099';

function hsl(h: number, s: number, l: number): string {
  const sat = s / 100;
  const lum = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sat * Math.min(lum, 1 - lum);
  const f = (n: number) => lum - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return `#${[f(0), f(8), f(4)]
    .map((x) => Math.round(x * 255).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()}`;
}

/** Teinte interdite : orange des leads (15–40°) ou bleu de l'IA (228–250°). */
function teinteReservee(h: number): boolean {
  return (h >= 15 && h <= 40) || (h >= 228 && h <= 250);
}

/** La première couleur libre de la palette, puis des teintes décalées. */
export function couleurMembreLibre(prises: readonly string[]): string {
  const utilisees = new Set(prises.map((c) => c.toUpperCase()));
  const libre = COULEURS_MEMBRES.find((c) => !utilisees.has(c));
  if (libre) return libre;
  for (let i = 0; i < 360; i += 1) {
    const h = (13 + i * 47) % 360;
    if (teinteReservee(h)) continue;
    const c = hsl(h, 46, i % 2 ? 38 : 52);
    if (!utilisees.has(c)) return c;
  }
  return COULEUR_SANS_TITULAIRE;
}

/** « Simon Ropiot » → « SR » ; un seul mot → ses deux premières lettres. */
export function initialesMembre(prenom: string | null | undefined, nom: string | null | undefined): string {
  const p = (prenom ?? '').trim();
  const n = (nom ?? '').trim();
  if (p && n) return `${p[0]}${n[0]}`.toUpperCase();
  const seul = p || n;
  return seul.slice(0, 2).toUpperCase();
}
