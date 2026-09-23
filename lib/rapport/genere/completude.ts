import { KINDS_GABARIT_V2, type KindGeneree } from '@/lib/rapport/modele-defaut';
import type { CompletudePage, DossierRapport } from '@/lib/rapport/genere/types';

export function pageConcurrentielPossible(d: DossierRapport): boolean {
  if (d.annonces.length === 0) return false;
  const nuage = d.annonces.filter((a) => a.surfaceM2 != null && a.prixM2 != null).length;
  return nuage >= 2;
}

export function completudePage(kind: KindGeneree, d: DossierRapport): CompletudePage {
  return { kind, manques: manquesKind(kind, d) };
}

export function completudeDossier(d: DossierRapport): CompletudePage[] {
  return KINDS_GABARIT_V2.map((kind) => completudePage(kind, d));
}

/** Seuls les faits sans lesquels la page n’a plus de sujet. Le reste s’affiche avec ce qui est connu. */
function manquesKind(kind: KindGeneree, d: DossierRapport): string[] {
  switch (kind) {
    case 'couverture':
      return d.adresse?.trim() ? [] : ['Adresse du bien'];
    case 'prix':
      return absents([[d.priceValue, 'Valeur estimée']]);
    case 'votre_bien':
    case 'description':
    case 'immeuble_appartement':
    case 'secteur':
    case 'points_interet':
    case 'connectivite':
    case 'permis':
    case 'comparables':
    case 'indices':
    case 'prochaine_etape':
      return [];
    case 'concurrentiel':
      return pageConcurrentielPossible(d) ? [] : ['Annonces insuffisantes'];
  }
}

function absents(pairs: Array<[unknown, string]>): string[] {
  return pairs.filter(([v]) => v == null || (typeof v === 'string' && !v.trim())).map(([, l]) => l);
}

export function manquesPagesIncompletes(
  pages: ReadonlyArray<{ kind: string; kindGeneree: KindGeneree | null; manques: string[] }>,
): Array<{ kind: KindGeneree; manques: string[] }> {
  return pages
    .filter((p) => p.kind === 'generee' && p.kindGeneree && p.manques.length > 0)
    .map((p) => ({ kind: p.kindGeneree!, manques: p.manques }));
}
