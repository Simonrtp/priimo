/**
 * Les adresses du référentiel arrivent sous deux formes : « 10 RUE DES
 * MARAICHERS » (cadastre, capitales) ou « 12 Rue des Maraîchers 75020 Paris »
 * (BAN, localité collée). La fiche parcelle affiche la voie en titre et la
 * localité à part : on les sépare et on remet une casse française.
 */

/** Types de voie, articles et indices de répétition : en minuscules hors tête. */
const MINUSCULES = new Set([
  'rue', 'avenue', 'av', 'boulevard', 'bd', 'place', 'impasse', 'allée', 'allee', 'chemin', 'quai',
  'passage', 'villa', 'cité', 'cite', 'square', 'cours', 'route', 'sentier', 'sente', 'ruelle', 'voie',
  'hameau', 'résidence', 'residence', 'parvis', 'esplanade', 'promenade', 'rond-point', 'galerie',
  'carrefour', 'faubourg', 'de', 'des', 'du', 'la', 'le', 'les', 'aux', 'au', 'et', 'sur', 'sous', 'en',
  'bis', 'ter', 'quater',
]);

function capitale(mot: string): string {
  return mot.charAt(0).toLocaleUpperCase('fr') + mot.slice(1);
}

/** « 10 RUE DES MARAICHERS » → « 10 rue des Maraichers ». */
export function formaterVoie(brut: string): string {
  const mots = brut.trim().replace(/\s+/g, ' ').toLocaleLowerCase('fr').split(' ').filter(Boolean);
  return mots
    .map((mot, i) => {
      if (/^\d/.test(mot)) return mot;
      if (i === 0) return mot.split('-').map(capitale).join('-');
      if (MINUSCULES.has(mot)) return mot;
      const elision = mot.match(/^([dl])['’](.+)$/);
      if (elision) return `${elision[1]}’${capitale(elision[2]!)}`;
      return mot.split('-').map(capitale).join('-');
    })
    .join(' ');
}

/** « Paris 20e Arrondissement » → « Paris » : le code postal dit déjà l'arrondissement. */
export function villeLisible(commune: string | null | undefined): string | null {
  const nette = (commune ?? '').replace(/\s+\d+\s*(er|e|ème)?\s+arrondissement\s*$/i, '').trim();
  return nette ? formaterVoie(nette) : null;
}

export type AdresseLisible = {
  /** « 10 rue des Maraichers » */
  voie: string;
  /** « 75020 Paris », quand on la connaît. */
  localite: string | null;
};

export function adresseLisible(
  brut: string,
  repli: { codePostal?: string | null; commune?: string | null } = {},
): AdresseLisible {
  const net = brut.trim().replace(/\s+/g, ' ');
  // La localité collée en fin de libellé : « … 75020 Paris » ou « …, 75020 Paris ».
  const colle = net.match(/^(.*?)[,\s]+(\d{5})\s+(.+)$/);
  const voie = formaterVoie(colle ? colle[1]! : net.replace(/,\s*$/, ''));
  const codePostal = colle?.[2] ?? repli.codePostal ?? null;
  const ville = colle ? villeLisible(colle[3]) : villeLisible(repli.commune);
  const localite = [codePostal, ville].filter(Boolean).join(' ') || null;
  return { voie, localite };
}
