import type { AdresseAJuger } from './types';

/**
 * Une adresse de lead est un texte unique (« 94 Rue de Buzenval 75020 Paris ») :
 * la base ne stocke ni le numéro ni le nom de voie séparément. Les règles de
 * voie ont besoin des deux, donc on les extrait ici, et seulement ici.
 *
 * Le parseur est volontairement prudent : ce qu'il ne reconnaît pas devient
 * `null`, et une règle de voie ne se déclenche jamais sur un champ absent.
 * Mieux vaut un lead qui tombe dans « Agence » qu'un lead attribué à tort.
 */

const SUFFIXES_NUMERO = new Set(['bis', 'ter', 'quater', 'quinquies', 'a', 'b', 'c', 'd']);

/** Abréviations vues dans les fichiers d'agence et dans les retours BAN. */
const ABREVIATIONS: Record<string, string> = {
  av: 'avenue',
  ave: 'avenue',
  bd: 'boulevard',
  bld: 'boulevard',
  blvd: 'boulevard',
  bvd: 'boulevard',
  imp: 'impasse',
  pl: 'place',
  pas: 'passage',
  rte: 'route',
  chem: 'chemin',
  all: 'allee',
  sq: 'square',
  st: 'saint',
  ste: 'sainte',
  sts: 'saints',
  qu: 'quai',
};

/**
 * Forme canonique d'un nom de voie : sans accent, sans casse, sans ponctuation,
 * abréviations développées. « Bd St-Germain » et « Boulevard Saint Germain »
 * doivent désigner la même rue, sinon une règle de voie est intenable.
 */
export function normaliserVoie(nom: string): string {
  const sansAccent = nom
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  return sansAccent
    .replace(/['’]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((mot) => ABREVIATIONS[mot] ?? mot)
    // « rue de la paix » et « rue paix » ne sont pas la même rue : on garde
    // les articles. On ne retire que le bruit de ponctuation.
    .join(' ');
}

export function memeVoie(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  const na = normaliserVoie(a);
  const nb = normaliserVoie(b);
  return na !== '' && na === nb;
}

export type AdresseDecoupee = {
  numero: number | null;
  nomVoie: string | null;
  codePostal: string | null;
};

/**
 * « 9 bis Avenue Taillade 75020 Paris » → 9, « Avenue Taillade », « 75020 ».
 * Le code postal est cherché en dernier groupe de cinq chiffres : une voie
 * peut contenir un nombre (« rue du 8 Mai 1945 »), la commune non.
 */
export function decouperAdresse(adresse: string | null | undefined): AdresseDecoupee {
  const brut = (adresse ?? '').trim();
  if (brut === '') return { numero: null, nomVoie: null, codePostal: null };

  const numeroMatch = /^(\d{1,4})\s*([a-zA-Z]{1,8})?\s+(.*)$/.exec(brut);
  let numero: number | null = null;
  let reste = brut;

  if (numeroMatch) {
    const suite = (numeroMatch[2] ?? '').toLowerCase();
    // « 12 rue … » : le mot qui suit le nombre fait partie de la voie.
    // « 12 bis rue … » : c'est un suffixe de numéro, on l'absorbe.
    const suffixe = suite !== '' && SUFFIXES_NUMERO.has(suite);
    numero = Number.parseInt(numeroMatch[1]!, 10);
    reste = suffixe
      ? numeroMatch[3]!
      : `${numeroMatch[2] ?? ''} ${numeroMatch[3]!}`.trim();
  }

  const codesPostaux = reste.match(/\b\d{5}\b/g);
  const codePostal = codesPostaux?.[codesPostaux.length - 1] ?? null;

  let voie = reste;
  if (codePostal) {
    const coupe = voie.lastIndexOf(codePostal);
    voie = voie.slice(0, coupe);
  }
  voie = voie.replace(/[,;]+\s*$/, '').trim();

  return {
    numero,
    nomVoie: voie === '' ? null : voie,
    codePostal,
  };
}

/**
 * Ce qu'il faut pour juger une adresse, quelle que soit la fiche d'origine.
 * `codePostal` explicite l'emporte sur celui deviné dans le texte : la colonne
 * est plus fiable que la chaîne saisie.
 */
export function adresseAJuger(source: {
  address?: string | null;
  postalCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  parcelleId?: string | null;
}): AdresseAJuger {
  const { numero, nomVoie, codePostal } = decouperAdresse(source.address);
  return {
    latitude: source.latitude ?? null,
    longitude: source.longitude ?? null,
    nomVoie,
    numero,
    codePostal: source.postalCode ?? codePostal,
    parcelleId: source.parcelleId ?? null,
  };
}
