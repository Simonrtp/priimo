import type { KindGeneree } from '@/lib/rapport/modele-defaut';
import type { CompletudePage, DossierRapport } from '@/lib/rapport/genere/types';
import { COMPARABLES_MIN } from '@/lib/rapport/genere/comparables';

export function completudePage(kind: KindGeneree, d: DossierRapport): CompletudePage {
  return { kind, manques: manquesKind(kind, d) };
}

export function completudeDossier(d: DossierRapport): CompletudePage[] {
  return (
    [
      'couverture',
      'votre_bien',
      'description',
      'immeuble_appartement',
      'secteur',
      'points_interet',
      'connectivite',
      'permis',
      'comparables',
      'concurrentiel',
      'indices',
      'prix',
      'prochaine_etape',
    ] as const
  ).map((kind) => completudePage(kind, d));
}

function manquesKind(kind: KindGeneree, d: DossierRapport): string[] {
  switch (kind) {
    case 'couverture':
      return d.adresse?.trim() ? [] : ['Adresse du bien'];
    case 'votre_bien':
      return absents([
        [d.propertyType, 'Type de bien'],
        [d.adresse, 'Adresse'],
        [d.surfaceM2, 'Surface habitable'],
        [d.client.nom, 'Nom du client'],
      ]);
    case 'description':
      return absents([[d.commentairesPublics, 'Commentaire public']]);
    case 'immeuble_appartement':
      return absents([
        [d.propertyType, 'Type de bien'],
        [d.rooms, 'Nombre de pièces'],
        [d.surfaceM2, 'Surface habitable'],
      ]);
    case 'secteur':
      return d.iris ? [] : ['Indicateurs logement de l’IRIS'];
    case 'points_interet':
      return d.equipements.length > 0 ? [] : ['Équipements à proximité'];
    case 'connectivite':
      return d.fixe.length > 0 || d.mobile.length > 0
        ? []
        : ['Éligibilité internet ou couverture mobile'];
    case 'permis':
      return d.permis.length > 0 ? [] : ['Autorisations d’urbanisme à proximité'];
    case 'comparables':
      if (d.comparables.length === 0) return ['Ventes comparables DVF'];
      if (d.comparables.length < COMPARABLES_MIN) {
        return [`Moins de ${COMPARABLES_MIN} ventes comparables après filtres`];
      }
      return [];
    case 'concurrentiel':
      return d.annonces.length > 0 ? [] : ['Annonces actives dans la zone'];
    case 'indices':
      return d.oat.length > 0 || (d.effort?.secteur != null)
        ? []
        : ['Taux OAT ou effort d’achat'];
    case 'prix':
      return absents([[d.priceValue, 'Valeur estimée']]);
    case 'prochaine_etape':
      return d.agent.nom || d.agence.nomCommercial ? [] : ['Identité de l’agence ou de l’agent'];
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
