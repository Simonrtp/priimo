/**
 * Correspondance de noms de personnes, tolérante aux fautes.
 *
 * « Cécile ROPIOTY » doit retrouver « Cécile Ropiot ». Le tokenizeur
 * d'adresses ne suffit pas : un nom se tape de mémoire, souvent mal.
 *
 * Règles :
 *  - normalisation avant comparaison (minuscules, accents retirés,
 *    traits d'union et apostrophes traités comme des espaces) ;
 *  - un token de 5 caractères ou plus correspond à distance de Levenshtein
 *    1 ou 2 ; en dessous, la correspondance doit être exacte ;
 *  - l'ordre ne compte pas, et un seul token distinctif suffit.
 */

/** Seuil à partir duquel une faute de frappe est tolérée. */
export const FUZZY_MIN_LEN = 5;
export const FUZZY_MAX_DISTANCE = 2;

/** Mots-outils fréquents devant un nom — ils ne distinguent personne. */
const NOM_STOPWORDS = new Set([
  'de',
  'du',
  'des',
  'la',
  'le',
  'les',
  'un',
  'une',
  'et',
  'chez',
  'monsieur',
  'madame',
  'mme',
  'mr',
  'm',
  'dossier',
  'fiche',
  'contact',
  'client',
  'nouvelles',
  'coordonnees',
  'telephone',
  'numero',
  'sur',
  'pour',
  'avec',
]);

/** Minuscules, sans accents, séparateurs de nom ramenés à des espaces. */
export function normalizeNom(input: string): string {
  return input
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('fr')
    .replace(/['’\-_.]/g, ' ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function nameTokens(input: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const token of normalizeNom(input).split(' ')) {
    if (token.length < 2) continue;
    if (NOM_STOPWORDS.has(token)) continue;
    if (seen.has(token)) continue;
    seen.add(token);
    out.push(token);
  }
  return out;
}

/**
 * Distance de Levenshtein, abandon dès que `max` est dépassé.
 * Deux lignes de travail : pas d'allocation par caractère.
 */
export function levenshtein(a: string, b: string, max = Infinity): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let previous = new Array<number>(b.length + 1);
  let current = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) previous[j] = j;

  for (let i = 1; i <= a.length; i++) {
    current[0] = i;
    let meilleur = current[0]!;
    for (let j = 1; j <= b.length; j++) {
      const cout = a[i - 1] === b[j - 1] ? 0 : 1;
      const valeur = Math.min(
        previous[j]! + 1,
        current[j - 1]! + 1,
        previous[j - 1]! + cout,
      );
      current[j] = valeur;
      if (valeur < meilleur) meilleur = valeur;
    }
    if (meilleur > max) return max + 1;
    const swap = previous;
    previous = current;
    current = swap;
  }
  return previous[b.length]!;
}

/** Un token de la question contre un token du nom en base. */
export function tokenMatches(recherche: string, candidat: string): boolean {
  if (recherche === candidat) return true;
  if (recherche.length < FUZZY_MIN_LEN) return false;
  return levenshtein(recherche, candidat, FUZZY_MAX_DISTANCE) <= FUZZY_MAX_DISTANCE;
}

export type NomScore = {
  /** 0 = aucune correspondance. Plus haut = plus sûr. */
  score: number;
  /** Nombre de tokens de la question retrouvés dans le nom. */
  tokensTrouves: number;
  /** Vrai si tous les tokens de la question ont été retrouvés. */
  complet: boolean;
  /** Vrai si au moins un token a demandé de la tolérance. */
  approximatif: boolean;
};

export const NOM_SANS_CORRESPONDANCE: NomScore = {
  score: 0,
  tokensTrouves: 0,
  complet: false,
  approximatif: false,
};

/**
 * Compare chaque token de la question à chaque token du nom en base.
 * Un token exact vaut 2, un token approché vaut 1 : les correspondances
 * franches remontent avant les approximations.
 */
export function scoreNom(
  recherche: string,
  ...champs: Array<string | null | undefined>
): NomScore {
  const attendus = nameTokens(recherche);
  if (attendus.length === 0) return { ...NOM_SANS_CORRESPONDANCE };

  const candidats = nameTokens(champs.filter(Boolean).join(' '));
  if (candidats.length === 0) return { ...NOM_SANS_CORRESPONDANCE };

  let score = 0;
  let tokensTrouves = 0;
  let approximatif = false;

  for (const attendu of attendus) {
    let meilleur = 0;
    for (const candidat of candidats) {
      if (attendu === candidat) {
        meilleur = 2;
        break;
      }
      if (tokenMatches(attendu, candidat)) meilleur = Math.max(meilleur, 1);
    }
    if (meilleur > 0) {
      score += meilleur;
      tokensTrouves += 1;
      if (meilleur === 1) approximatif = true;
    }
  }

  if (tokensTrouves === 0) return { ...NOM_SANS_CORRESPONDANCE };
  const complet = tokensTrouves === attendus.length;
  // Un nom entièrement retrouvé passe devant une correspondance partielle.
  return { score: complet ? score + 3 : score, tokensTrouves, complet, approximatif };
}

/** Suggestions après un échec : plus permissif que la correspondance elle-même. */
export const PROCHE_MAX_DISTANCE = 3;

function tokenProche(recherche: string, candidat: string): boolean {
  if (tokenMatches(recherche, candidat)) return true;
  const court = recherche.length <= candidat.length ? recherche : candidat;
  const long = court === recherche ? candidat : recherche;
  if (court.length >= 3 && long.startsWith(court)) return true;
  if (recherche.length < FUZZY_MIN_LEN) return false;
  return levenshtein(recherche, candidat, PROCHE_MAX_DISTANCE) <= PROCHE_MAX_DISTANCE;
}

/**
 * « Vouliez-vous dire… ? ». Une suggestion visiblement fausse se repère d'un
 * coup d'œil ; une absence de suggestion ne s'explique pas.
 */
export function scoreProche(
  recherche: string,
  ...champs: Array<string | null | undefined>
): number {
  const attendus = nameTokens(recherche);
  const candidats = nameTokens(champs.filter(Boolean).join(' '));
  if (attendus.length === 0 || candidats.length === 0) return 0;

  let score = 0;
  for (const attendu of attendus) {
    for (const candidat of candidats) {
      if (attendu === candidat) {
        score += 2;
        break;
      }
      if (tokenProche(attendu, candidat)) {
        score += 1;
        break;
      }
    }
  }
  return score;
}

/** Un seul token distinctif suffit à faire remonter la fiche. */
export function nomCorrespondApprox(
  recherche: string,
  ...champs: Array<string | null | undefined>
): boolean {
  return scoreNom(recherche, ...champs).score > 0;
}

/**
 * Fragments à envoyer en `ilike` pour ratisser large avant le filtrage local.
 * Le début d'un nom est rarement mal tapé : on garde les premiers caractères,
 * sans accent — d'où un filtrage local obligatoire derrière.
 */
export function namePrefixPatterns(recherche: string, taille = 4): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const token of nameTokens(recherche)) {
    const prefixe = token.slice(0, Math.min(taille, token.length));
    if (prefixe.length < 3 || seen.has(prefixe)) continue;
    seen.add(prefixe);
    out.push(prefixe);
  }
  return out.slice(0, 4);
}
