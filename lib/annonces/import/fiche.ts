/**
 * Page téléchargée → fiche d'annonce, pour n'importe quel site.
 *
 *   1. le lecteur du portail (SeLoger, Leboncoin, PAP) : données structurées ;
 *   2. schema.org, que publient beaucoup de sites d'agences ;
 *   3. Mon assistant sur le texte visible, seulement s'il manque l'essentiel
 *      (prix, surface, conso chiffrée) : la lecture universelle.
 * Les données structurées l'emportent toujours sur la lecture du texte.
 */
import { chiffresDpeDuTexte, lireJsonLd, lireLeboncoin, lirePap, lireSeLoger, texteVisible, type Partielle } from './pages';
import { valeursFiables } from './localiser';
import { ficheDepuisExtraction, zoneDepuisAdresse } from './extraction';
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
  const portail = u.portail === 'seloger' ? lireSeLoger(html) : u.portail === 'leboncoin' ? lireLeboncoin(html) : u.portail === 'pap' ? lirePap(html) : null;
  const structure = completer(portail ?? {}, lireJsonLd(html) ?? {});
  return completer(structure, chiffresDpeDuTexte(structure.description));
}

/** Faut-il demander à Mon assistant ? Seulement s'il manque de quoi afficher ou localiser. */
export function lectureIncomplete(p: Partielle): boolean {
  const { conso } = valeursFiables({
    consoKwhM2: p.consoKwhM2 ?? null,
    gesKgM2: p.gesKgM2 ?? null,
    dpe: p.dpe ?? null,
    ges: p.ges ?? null,
    dpeApresJuillet2021: p.dpeApresJuillet2021 ?? null,
  });
  return p.prix == null || p.surface == null || conso == null;
}

type Assistant = (texte: string) => Promise<Record<string, unknown> | null>;

export async function ficheDepuisPage(
  u: UrlAnnonce,
  html: string,
  /** Mon assistant, déjà plafonné par l'appelant (serveur.ts). */
  assistant: Assistant,
): Promise<FicheAnnonce | null> {
  let p = lecturePortail(u, html);
  if (lectureIncomplete(p)) {
    const texte = [p.titre, p.description, texteVisible(html)].filter(Boolean).join('\n');
    const json = await assistant(texte);
    if (json) {
      const lue: Partielle & Partial<FicheAnnonce> = { ...ficheDepuisExtraction(json, u, p.description ?? '') };
      delete lue.portail;
      delete lue.idPortail;
      delete lue.url;
      p = completer(p, lue);
      // Une adresse écrite dans le texte vaut mieux qu'un repère flouté.
      if (!p.zone || p.zone.rayonM > 0) {
        const exacte = await zoneDepuisAdresse(json, p.codePostal ?? null);
        if (exacte) p.zone = exacte;
      }
    }
  }
  if (p.prix == null && p.surface == null) return null;
  return { ...ficheVide(u), ...p, photos: p.photos ?? [] };
}
