/**
 * Les décisions du balayage, pures : ce qu'une carte change à une annonce
 * connue, jusqu'où lire SeLoger, quand relire une fiche pour un retrait.
 */
import type { CarteBalayage } from './portails';

/** SeLoger est relu en entier une fois par semaine : baisses de prix des anciennes, retraits. */
export const JOURS_ENTRE_BALAYAGES_COMPLETS = 7;
/** Un soir ordinaire, au plus ces pages SeLoger (≈ 300 annonces, huit jours de nouveautés). */
export const PAGES_SELOGER_MAX_RECENT = 10;
/** Garde-fou d'un balayage complet ou d'une suite PAP qui ne finirait pas. */
export const PAGES_MAX = 60;
export const ANNONCES_PAR_PAGE_SELOGER = 30;
/** Marge du soir ordinaire : on relit les annonces créées depuis le passage d'avant, moins un jour. */
const MARGE_RECENT_MS = 24 * 3600_000;
/** Absente d'un balayage complet et pas vue depuis 20 h : sa fiche est rouverte avant de la dire retirée. */
const DELAI_RETRAIT_MS = 20 * 3600_000;

export type ModeSeLoger = { mode: 'complet' } | { mode: 'recent'; depuis: string };

/**
 * Complet la première fois et une fois par semaine ; sinon les annonces
 * créées depuis le dernier passage (moins un jour de marge).
 */
export function modeSeLoger(dernierComplet: string | null, dernierPassage: string | null, maintenant: Date): ModeSeLoger {
  if (!dernierComplet || !dernierPassage) return { mode: 'complet' };
  if (maintenant.getTime() - Date.parse(dernierComplet) >= JOURS_ENTRE_BALAYAGES_COMPLETS * 86_400_000 - 3600_000) return { mode: 'complet' };
  return { mode: 'recent', depuis: new Date(Date.parse(dernierPassage) - MARGE_RECENT_MS).toISOString() };
}

/**
 * Soir ordinaire : la page suivante vaut d'être lue si celle-ci contenait
 * encore une annonce créée après le seuil. Les annonces mises en avant (vieilles,
 * en tête de liste) ne relancent rien : il en faut une récente.
 */
export function continuerSeLoger(o: { datesCreation: readonly string[]; depuis: string; page: number; total: number | null }): boolean {
  if (o.page >= PAGES_SELOGER_MAX_RECENT) return false;
  if (o.total != null && o.page * ANNONCES_PAR_PAGE_SELOGER >= o.total) return false;
  const seuil = Date.parse(o.depuis);
  return o.datesCreation.some((d) => Date.parse(d) > seuil);
}

/** Toutes les pages d'un balayage complet, d'après le total annoncé en page 1. */
export function pagesCompletesSeLoger(total: number | null): number {
  if (total == null || total <= 0) return 1;
  return Math.min(PAGES_MAX, Math.ceil(total / ANNONCES_PAR_PAGE_SELOGER));
}

/** Ce qu'on garde d'une annonce en base pour la comparer à la carte du soir. */
export type Connue = {
  id: string;
  statut: 'active' | 'retiree';
  prix: number | null;
  retireeLe: string | null;
};

export type Evenement = { type: 'nouvelle' | 'baisse_prix' | 'hausse_prix' | 'remise_en_ligne' | 'retiree'; avant: Record<string, unknown>; apres: Record<string, unknown> };

/**
 * Ce que la carte du soir change à l'annonce connue : colonnes à écrire et
 * événements. Un champ absent de la carte n'efface jamais la base.
 */
export function suivreCarte(connue: Connue, carte: CarteBalayage, vueLe: string): { colonnes: Record<string, unknown>; evenements: Evenement[] } {
  const colonnes: Record<string, unknown> = { derniere_vue_le: vueLe };
  const evenements: Evenement[] = [];
  if (connue.statut === 'retiree') {
    colonnes.statut = 'active';
    colonnes.retiree_le = null;
    evenements.push({ type: 'remise_en_ligne', avant: { retiree_le: connue.retireeLe }, apres: { prix: carte.prix } });
  }
  if (carte.prix != null && connue.prix != null && Math.round(carte.prix) !== connue.prix) {
    const prix = Math.round(carte.prix);
    colonnes.prix = prix;
    evenements.push({
      type: prix < connue.prix ? 'baisse_prix' : 'hausse_prix',
      avant: { prix: connue.prix },
      apres: { prix, variation_pct: Math.round(((prix - connue.prix) / connue.prix) * 1000) / 10 },
    });
  } else if (carte.prix != null && connue.prix == null) {
    colonnes.prix = Math.round(carte.prix);
  }
  return { colonnes, evenements };
}

/** Une annonce jamais vue : la ligne à créer, en attendant la lecture de sa fiche. */
export function nouvelleLigne(carte: CarteBalayage, codePostal: string, vueLe: string): Record<string, unknown> {
  const prix = carte.prix != null ? Math.round(carte.prix) : null;
  return {
    portail: carte.portail,
    id_portail: carte.idPortail,
    url: carte.url,
    type_vendeur: 'particulier',
    statut: 'active',
    origine: 'veille',
    publiee_le: carte.creeeLe,
    premiere_vue_le: vueLe,
    derniere_vue_le: vueLe,
    type_bien: carte.typeBien,
    prix_initial: prix,
    prix,
    surface: carte.surface != null ? Math.round(carte.surface * 100) / 100 : null,
    pieces: carte.pieces != null ? Math.round(carte.pieces) : null,
    dpe: carte.dpe,
    code_postal: codePostal,
    confiance: 'incertaine',
    localisation_precision: 'code_postal',
  };
}

/**
 * Après un balayage complet d'un code postal : les annonces actives qu'il n'a
 * pas revues (pas vues depuis 20 h) sont à vérifier en rouvrant leur fiche.
 */
export function aVerifierPourRetrait<T extends { statut: string; derniereVueLe: string }>(lignes: readonly T[], debutBalayage: string): T[] {
  const limite = Date.parse(debutBalayage) - DELAI_RETRAIT_MS;
  return lignes.filter((l) => l.statut === 'active' && Date.parse(l.derniereVueLe) <= limite);
}

/** La nuit de balayage : la date du jour à Paris. */
export function nuitDe(maintenant: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(maintenant);
}
