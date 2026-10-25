/**
 * Les pages de résultats que le balayage lit chaque nuit. Pur, sans réseau.
 *
 * PAP : seules les pages que son robots.txt autorise (« vente immobilière
 * Paris 11e », listées dans son sitemap). Ses pages de recherche habituelles
 * (`/annonce/vente-appartement-maison-…`) lui sont interdites aux robots, et
 * Bright Data refuse de les servir. On suit le lien « Suivante » jusqu'à ce que
 * PAP passe aux communes voisines (`/proximite/`, interdit aussi) : le code
 * postal est alors épuisé. Toutes ses annonces sont de particuliers.
 *
 * SeLoger : la recherche triée par date (`order=DateDesc`), 30 annonces par
 * page. Le JSON des résultats dit qui publie (`type: PRIVATE` = particulier) ;
 * SeLoger n'a pas de filtre « particuliers » : on lit tout et on trie.
 *
 * Mesures du 25/10/2026 (75011, 75020) : PAP ~100 annonces par arrondissement,
 * SeLoger ~1 300 dont 5 à 7 % de particuliers, ~35 annonces neuves par jour.
 */
import { analyserUrl } from '@/lib/annonces/import/url';

export const PORTAILS_BALAYES = ['pap', 'seloger'] as const;
export type PortailBalaye = (typeof PORTAILS_BALAYES)[number];

/** Ce qu'une page de résultats dit d'une annonce de particulier. */
export type CarteBalayage = {
  portail: PortailBalaye;
  /** Même clé que l'import par URL (`cleImport`) : les deux se reconnaissent. */
  idPortail: string;
  url: string;
  codePostal: string | null;
  prix: number | null;
  surface: number | null;
  pieces: number | null;
  dpe: string | null;
  typeBien: 'appartement' | 'maison' | null;
  /** SeLoger seulement : date de création de l'annonce (ISO). */
  creeeLe: string | null;
};

// ---------------------------------------------------------------- lieux

/**
 * Identifiants de lieu des portails. Paris : suite continue par arrondissement
 * (75005 → g37772 / POCOFR4799, 75011 → g37778 / POCOFR4805, 75020 → g37787 /
 * POCOFR4814). Ailleurs : SeLoger relevé un par un ; PAP demande aussi le nom
 * de la commune dans l'URL, pas encore relevé. Un code postal inconnu n'est pas
 * balayé (journalisé), plutôt que deviné.
 */
const LIEUX_SELOGER: Record<string, string> = {
  '74500': 'POCOFR4774',
  '72000': 'POCOFR4631',
  '72100': 'POCOFR4632',
  '72230': 'POCOFR4644',
  '72600': 'POCOFR4672',
  '72700': 'POCOFR4675',
};

function arrondissementParis(cp: string): number | null {
  const m = cp.match(/^750(\d{2})$/);
  const n = m ? Number(m[1]) : NaN;
  return n >= 1 && n <= 20 ? n : null;
}

/** Page 1 PAP d'un code postal : « vente immobilière » (autorisée aux robots). */
export function premierePagePap(cp: string): string | null {
  const arr = arrondissementParis(cp);
  return arr != null ? `https://www.pap.fr/annonce/vente-immobiliere-paris-${arr === 1 ? '1er' : `${arr}e`}-g${37767 + arr}` : null;
}

export function lieuSeLoger(cp: string): string | null {
  const arr = arrondissementParis(cp);
  if (arr != null) return `POCOFR${4794 + arr}`;
  return LIEUX_SELOGER[cp] ?? null;
}

/** Ventes d'appartements et de maisons, les plus récentes d'abord. */
export function pageSeLoger(lieu: string, page: number): string {
  return `https://www.seloger.com/classified-search?distributionTypes=Buy&estateTypes=House,Apartment&locations=${lieu}&order=DateDesc${page > 1 ? `&page=${page}` : ''}`;
}

// ---------------------------------------------------------------- texte

const ENTITES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', euro: '€', eacute: 'é', egrave: 'è' };

function texte(fragment: string): string {
  return fragment
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&([a-z]+);/gi, (m, e: string) => ENTITES[e.toLowerCase()] ?? m)
    .replace(/\s+/g, ' ')
    .trim();
}

function nombre(t: string | undefined): number | null {
  if (!t) return null;
  const n = Number(t.replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
}

// ---------------------------------------------------------------- PAP

/** « Paris 11E », « Montreuil (93100) », « Paris 20E à 2km de Paris 11e » → code postal. */
function codePostalPap(lieu: string): string | null {
  const propre = lieu.replace(/\s*à\s*\d+(?:[.,]\d+)?\s*km\s+de\s.*$/i, '');
  const cp = propre.match(/\((\d{5})\)/)?.[1];
  if (cp) return cp;
  const arr = propre.match(/\bParis\s*(\d{1,2})\s*(?:er|ème|eme|e|ᵉ)\b/i)?.[1];
  return arr && Number(arr) >= 1 && Number(arr) <= 20 ? `750${arr.padStart(2, '0')}` : null;
}

/** Les annonces d'une page PAP : logements seulement (ni parking, ni local, ni fonds de commerce). */
export function lirePagePap(html: string): CarteBalayage[] {
  const cartes: CarteBalayage[] = [];
  const vus = new Set<string>();
  for (const bloc of html.split('<div class="search-list-item-alt"').slice(1)) {
    const lien = bloc.match(/<a class="item-title" href="([^"]+)"/)?.[1];
    if (!lien) continue;
    const typeBien = lien.match(/^\/annonces\/(appartement|maison)-/)?.[1] as 'appartement' | 'maison' | undefined;
    if (!typeBien) continue;
    const u = analyserUrl(`https://www.pap.fr${lien}`);
    if (!u?.idPortail || vus.has(u.idPortail)) continue;
    vus.add(u.idPortail);
    const prix = texte(bloc.match(/class="item-price[^"]*">([\s\S]*?)<\/span>/)?.[1] ?? '');
    const tags = [...(bloc.match(/<ul class="item-tags">([\s\S]*?)<\/ul>/)?.[1] ?? '').matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) => texte(m[1]!));
    cartes.push({
      portail: 'pap',
      idPortail: u.idPortail,
      url: u.url,
      codePostal: codePostalPap(texte(bloc.match(/<span class="h1">([\s\S]*?)<\/span>/)?.[1] ?? '')),
      prix: nombre(prix.split('€')[0]?.replace(/\./g, '')),
      surface: nombre(tags.find((t) => /m²$/.test(t))?.replace(/\s*m²$/, '')),
      pieces: nombre(tags.find((t) => /pi[èe]ces?$/.test(t))?.match(/^(\d+)/)?.[1]),
      dpe: bloc.match(/item-thumb-dpe-([a-g])\b/)?.[1]?.toUpperCase() ?? null,
      typeBien,
      creeeLe: null,
    });
  }
  return cartes;
}

/**
 * La page suivante, tant qu'elle reste dans le code postal. Après la dernière,
 * PAP enchaîne sur les communes voisines (`/proximite/…`) : c'est la fin.
 */
export function pageSuivantePap(html: string): string | null {
  const href = html.match(/id="pagination-next" href="([^"]+)"/)?.[1];
  if (!href || !href.startsWith('/annonce/')) return null;
  return `https://www.pap.fr${href}`;
}

// ---------------------------------------------------------------- SeLoger

type Brut = Record<string, unknown>;
const objet = (v: unknown): Brut => (v && typeof v === 'object' ? (v as Brut) : {});

/** Les annonces de particuliers d'une page SeLoger, et ce que la page dit du total. */
export function lirePageSeLoger(html: string): { lisible: boolean; total: number | null; annonces: number; cartes: CarteBalayage[]; datesCreation: string[] } {
  const m = html.match(/window\["__UFRN_FETCHER__"\]=JSON\.parse\(("(?:[^"\\]|\\.)*")\);?<\/script>/);
  if (!m) return { lisible: false, total: null, annonces: 0, cartes: [], datesCreation: [] };
  let data: Brut;
  try {
    data = objet(JSON.parse(JSON.parse(m[1]!) as string));
  } catch {
    return { lisible: false, total: null, annonces: 0, cartes: [], datesCreation: [] };
  }
  const serp = objet(objet(data.data)['classified-serp-data']);
  const fiches = objet(serp.classifiedsData);
  const ids = Array.isArray(serp.classifieds) ? serp.classifieds : [];
  const cartes: CarteBalayage[] = [];
  const datesCreation: string[] = [];
  for (const id of ids) {
    const f = objet(fiches[String(id)]);
    const creee = objet(f.metadata).creationDate;
    if (typeof creee === 'string') datesCreation.push(creee);
    if (f.type !== 'PRIVATE') continue;
    const chemin = typeof f.url === 'string' ? f.url : '';
    const u = analyserUrl(chemin.startsWith('/') ? `https://www.seloger.com${chemin}` : chemin);
    if (!u?.idPortail || u.portail !== 'seloger') continue;
    const brut = objet(f.rawData);
    const type = String(brut.propertyType ?? '').toLowerCase();
    cartes.push({
      portail: 'seloger',
      idPortail: u.idPortail,
      url: u.url,
      codePostal: typeof objet(objet(f.location).address).zipCode === 'string' ? (objet(objet(f.location).address).zipCode as string) : null,
      prix: typeof brut.price === 'number' ? brut.price : nombre(String(brut.price ?? '')),
      surface: nombre(String(objet(brut.surface).main ?? '')),
      pieces: nombre(String(brut.nbroom ?? '')),
      dpe: typeof f.energyClass === 'string' && /^[A-G]$/.test(f.energyClass) ? f.energyClass : null,
      typeBien: /house|maison/.test(type) ? 'maison' : /apartment|appartement|flat/.test(type) ? 'appartement' : null,
      creeeLe: typeof creee === 'string' ? creee : null,
    });
  }
  const total = typeof serp.totalCount === 'number' ? serp.totalCount : null;
  return { lisible: true, total, annonces: ids.length, cartes, datesCreation };
}

// ---------------------------------------------------------------- fiches

/**
 * « NB : Le propriétaire refuse le démarchage commercial » : PAP l'écrit sous le
 * numéro du vendeur (presque toutes les fiches). C'est un refus d'appel
 * commercial, pas de visite : l'agent doit le voir avant de téléphoner.
 */
export function refusDemarchage(html: string): boolean {
  return /refuse\s+(?:tout\s+)?le\s+d[ée]marchage/i.test(html);
}

/**
 * Une fiche relue qui ne contient plus l'annonce : retirée. PAP renvoie vers
 * une liste, SeLoger vers une recherche (pages complètes, sans l'annonce).
 */
export function ficheDisparue(portail: PortailBalaye, html: string): boolean {
  if (portail === 'pap') return !html.includes('<h1 class="item-title');
  return !html.includes('__UFRN_LIFECYCLE_SERVERREQUEST__');
}
