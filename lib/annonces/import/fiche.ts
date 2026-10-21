/**
 * Page téléchargée → fiche d'annonce, pour n'importe quel site.
 *
 *   1. le lecteur du portail (SeLoger, SeLoger Neuf, Leboncoin, PAP) : données structurées ;
 *   2. schema.org, que publient beaucoup de sites d'agences ;
 *   3. Mon assistant sur le texte visible, seulement s'il manque l'essentiel
 *      (prix, surface, de quoi localiser) : la lecture universelle. Il peut,
 *      d'une fois sur l'autre, rendre prix et surface vides : une seconde
 *      lecture est faite avant de renoncer.
 * Les données structurées l'emportent toujours sur la lecture du texte.
 * Une adresse écrite par le site est ensuite retrouvée au numéro près (BAN).
 */
import { chiffresDpeDuTexte, lireJsonLd, lireLeboncoin, lirePap, lireSeLoger, texteVisible, type Partielle } from './pages';
import { rueDepuisTexte, valeursFiables } from './localiser';
import { ficheDepuisExtraction, zoneDepuisAdresse, zoneDepuisAdressePubliee } from './extraction';
import { lireSeLogerNeuf } from './seloger-neuf';
import type { FicheAnnonce } from './types';
import type { UrlAnnonce } from './url';

export function ficheVide(u: UrlAnnonce): FicheAnnonce {
  return {
    portail: u.portail,
    idPortail: u.idPortail,
    url: u.url,
    typeVendeur: 'particulier',
    agenceNom: null,
    typeBien: null,
    titre: null,
    prix: null,
    surface: null,
    pieces: null,
    etage: null,
    dpe: null,
    consoKwhM2: null,
    ges: null,
    gesKgM2: null,
    dpeApresJuillet2021: null,
    dateDpe: null,
    anneeConstruction: null,
    chauffage: null,
    codePostal: null,
    ville: null,
    quartier: null,
    description: null,
    datePublication: null,
    zone: null,
    photos: [],
  };
}

function vide(v: unknown): boolean {
  return v == null || v === '' || (Array.isArray(v) && v.length === 0);
}

/** Complète `base` avec ce que `ajout` sait et que `base` ignore. */
export function completer(base: Partielle, ajout: Partielle): Partielle {
  const r: Partielle = { ...base };
  for (const [cle, valeur] of Object.entries(ajout) as [keyof Partielle, unknown][]) {
    if (vide(r[cle]) && !vide(valeur)) (r as Record<string, unknown>)[cle] = valeur;
  }
  return r;
}

export function lecturePortail(u: UrlAnnonce, html: string): Partielle {
  const portail =
    u.portail === 'seloger'
      ? (lireSeLoger(html) ?? lireSeLogerNeuf(html))
      : u.portail === 'leboncoin'
        ? lireLeboncoin(html)
        : u.portail === 'pap'
          ? lirePap(html)
          : null;
  const structure = completer(portail ?? {}, lireJsonLd(html) ?? {});
  return completer(structure, chiffresDpeDuTexte(structure.description));
}

/** Faut-il demander à Mon assistant ? Seulement s'il manque de quoi afficher ou localiser. */
export function lectureIncomplete(p: Partielle): boolean {
  if (p.prix == null || p.surface == null) return true;
  // Une adresse publiée ou un point exact localisent sans passer par la conso du DPE.
  if (p.adressePubliee || p.zone?.rayonM === 0) return false;
  const { conso } = valeursFiables({
    consoKwhM2: p.consoKwhM2 ?? null,
    gesKgM2: p.gesKgM2 ?? null,
    dpe: p.dpe ?? null,
    ges: p.ges ?? null,
    dpeApresJuillet2021: p.dpeApresJuillet2021 ?? null,
  });
  return conso == null;
}

/** De quoi montrer l'annonce : un chiffre, ou un endroit sur la carte. */
export function ficheExploitable(p: Partielle): boolean {
  return p.prix != null || p.surface != null || p.zone != null || Boolean(p.adressePubliee && p.codePostal);
}

type Assistant = (texte: string) => Promise<Record<string, unknown> | null>;
type Geocodeur = (adresse: string, codePostal: string) => Promise<FicheAnnonce['zone']>;

const geocoderBan: Geocodeur = zoneDepuisAdressePubliee;

/** Mon assistant est relu une fois si prix et surface reviennent vides. */
const LECTURES_ASSISTANT = 2;
/** Au-delà, le point publié et l'adresse écrite ne parlent pas du même endroit : on garde le point. */
const ECART_ADRESSE_MAX_M = 300;

type Zone = NonNullable<FicheAnnonce['zone']>;

function ecartM(a: Zone, b: Zone): number {
  return Math.hypot((a.longitude - b.longitude) * 73_000, (a.latitude - b.latitude) * 111_000);
}

/** Marge autour d'un repère publié : une adresse du texte doit y tomber pour être crue. */
const MARGE_REPERE_M = 150;

/** Pas de repère publié : rien à contredire. */
export function dansLeRepere(point: Zone, repere: Zone | null | undefined): boolean {
  if (!repere) return true;
  return ecartM(point, repere) <= repere.rayonM + MARGE_REPERE_M;
}

/** L'adresse retrouvée remplace le repère s'il est plus vague ; un point exact ne cède qu'à un point exact proche. */
function meilleureZone(repere: Zone | null | undefined, adresse: Zone): boolean {
  if (!repere) return true;
  if (repere.rayonM > 0) return adresse.rayonM < repere.rayonM;
  return adresse.rayonM === 0 && ecartM(adresse, repere) <= ECART_ADRESSE_MAX_M;
}

export async function ficheDepuisPage(
  u: UrlAnnonce,
  html: string,
  /** Mon assistant, déjà plafonné par l'appelant (serveur.ts). */
  assistant: Assistant,
  geocoder: Geocodeur = geocoderBan,
): Promise<FicheAnnonce | null> {
  let p = lecturePortail(u, html);
  const texte = [p.titre, p.description, texteVisible(html)].filter(Boolean).join('\n');
  // Le repère publié par le portail : ce que le texte trouve doit tomber dedans.
  const reperePortail = p.zone ?? null;
  // Un district SeLoger (« République-Saint Ambroise ») n’est pas une rue. La rue
  // se cherche dans la seule description : le reste de la page porte l'adresse
  // de l'agence (« 111 boulevard Richard Lenoir », vue le 21/10/2026).
  let rueDuTexte = false;
  if (!rueDepuisTexte(p.adressePubliee ?? '')) {
    const rue = rueDepuisTexte(p.description);
    // Une rue nue (« rue Crozatier ») peut être un voisinage : elle compte au score
    // (voie citée), elle ne devient ni repère ni adresse affichée.
    p.adressePubliee = rue && /^\d/.test(rue) ? rue : null;
    rueDuTexte = p.adressePubliee != null;
  }
  for (let lecture = 0; lecture < LECTURES_ASSISTANT && lectureIncomplete(p); lecture += 1) {
    // La relecture ne sert qu'à rattraper un prix et une surface rendus vides.
    if (lecture > 0 && (p.prix != null || p.surface != null)) break;
    const json = await assistant(texte);
    if (json) {
      const lue: Partielle & Partial<FicheAnnonce> = { ...ficheDepuisExtraction(json, u, p.description ?? '') };
      delete lue.portail;
      delete lue.idPortail;
      delete lue.url;
      p = completer(p, lue);
      // Une adresse écrite dans le texte vaut mieux qu'un repère flouté — si elle tombe dans le repère publié.
      if (!p.zone || p.zone.rayonM > 0) {
        const exacte = await zoneDepuisAdresse(json, p.codePostal ?? null);
        // Un numéro et une voie seulement (rayon 0) : une rue nue peut n'être qu'un voisinage.
        if (exacte && exacte.rayonM === 0 && dansLeRepere(exacte, reperePortail)) p.zone = exacte;
      }
    }
  }
  // L'adresse écrite par le site, retrouvée dans la BAN : plus sûre qu'un repère, si elle s'accorde avec le point publié.
  if (p.adressePubliee && p.codePostal) {
    const retrouvee = await geocoder(p.adressePubliee, p.codePostal);
    // Une rue lue dans le texte ne sort jamais l'annonce du quartier publié par le portail.
    const admise = retrouvee && (!rueDuTexte || dansLeRepere(retrouvee, reperePortail));
    if (retrouvee && admise && meilleureZone(p.zone, retrouvee)) p.zone = retrouvee;
    else if (rueDuTexte && !admise) p.adressePubliee = null;
  }
  if (!ficheExploitable(p)) return null;
  return { ...ficheVide(u), ...p, photos: p.photos ?? [] };
}
