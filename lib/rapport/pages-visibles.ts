import { estKindAbsorbee, estPageTestBibliotheque, type KindGeneree } from '@/lib/rapport/modele-defaut';
import { kindGenereeDepuisContenu, type PageRapportComposee } from '@/lib/rapport/pages';

export function kindDepuisPage(page: {
  kind?: string;
  source?: string;
  kindGeneree?: KindGeneree | null;
  contenu?: unknown;
}): KindGeneree | null {
  if (page.kindGeneree) return page.kindGeneree;
  if (page.kind === 'generee' || page.source === 'generee') {
    return kindGenereeDepuisContenu(page.contenu);
  }
  return null;
}

/**
 * Une section n’existe qu’une fois. Les pages absorbées par le gabarit 7
 * et les captures de test disparaissent.
 */
export function retenirPagesUniques<T extends {
  id: string;
  nom?: string;
  kind?: string;
  source?: string;
  kindGeneree?: KindGeneree | null;
  contenu?: unknown;
}>(pages: readonly T[]): { gardees: T[]; retirees: T[] } {
  const vus = new Set<KindGeneree>();
  const gardees: T[] = [];
  const retirees: T[] = [];
  for (const page of pages) {
    const kind = kindDepuisPage(page);
    if (kind) {
      if (estKindAbsorbee(kind) || vus.has(kind)) {
        retirees.push(page);
        continue;
      }
      vus.add(kind);
      gardees.push(page);
      continue;
    }
    if (estPageTestBibliotheque(page.nom)) {
      retirees.push(page);
      continue;
    }
    gardees.push(page);
  }
  return { gardees, retirees };
}

/** Pages remises à l’écran, au PDF et en présentation. */
export function pagesVisiblesRapport(pages: readonly PageRapportComposee[]): PageRapportComposee[] {
  return retenirPagesUniques(pages).gardees.filter((page) => {
    if (page.kind !== 'generee') return true;
    if (page.kindGeneree === 'concurrentiel' && page.manques.length > 0) return false;
    return true;
  });
}

/**
 * Chromium + `break-after: page` produit souvent une feuille vide après
 * chaque section. On ne recopie que les pages utiles.
 */
export function indicesPagesChrome(chromeCount: number, kindCount: number): number[] {
  if (kindCount <= 0 || chromeCount <= 0) return [];
  if (chromeCount >= kindCount * 2) {
    return Array.from({ length: kindCount }, (_, i) => {
      const idx = i * 2;
      return idx < chromeCount ? idx : i;
    });
  }
  return Array.from({ length: Math.min(chromeCount, kindCount) }, (_, i) => i);
}
