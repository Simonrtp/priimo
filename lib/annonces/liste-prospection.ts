/**
 * Les annonces de particuliers à prospecter : la Liste de Prospection et
 * « Mes nouvelles adresses » (accueil) en lisent la même sélection, pour que
 * « Voir tout » retrouve exactement le compte annoncé. Pur.
 *
 * Une annonce appartient à un seul secteur, le plus précis qui la contient
 * (même règle que la carte). Un logement publié sur PAP et SeLoger ne compte
 * qu'une fois.
 */
import { secteurDefini } from '@/lib/carte/emprise';
import { trierSecteurs } from '@/lib/zones/nom';
import type { Zone } from '@/lib/zones/types';
import { adresseVisible, regrouperAnnonces } from './presenter';
import { dansMonSecteur, zoneDeLAnnonce } from './secteur';
import type { Annonce, GroupeAnnonce } from './types';

/** Au moins un secteur dessiné à mon nom : un nom sans contour ni rue ne contient rien. */
export function aUnSecteur(zones: readonly Zone[], profileId: string): boolean {
  return zones.some((z) => z.assignedTo === profileId && secteurDefini(z));
}

/** Adresse affirmée (retrouvée ou publiée), pas seulement la rue ou le quartier. */
export function adresseVerifiee(annonce: Annonce): boolean {
  return Boolean(annonce.adresse) && adresseVisible(annonce.confiance);
}

function date(a: Annonce): string {
  return a.publieeLe ?? a.premiereVueLe ?? '';
}

function aProspecter(a: Annonce): boolean {
  return a.statut === 'active' && a.typeVendeur === 'particulier';
}

/**
 * Regroupe les portails d'un même logement (l'annonce qui porte l'adresse
 * devant) ; la plus récente d'abord.
 */
function ordonner(annonces: readonly Annonce[]): GroupeAnnonce[] {
  return regrouperAnnonces(annonces)
    .map((g) => ({ ...g, principale: g.annonces.find(adresseVerifiee) ?? g.principale }))
    .sort((x, y) => {
      const dx = x.annonces.reduce((m, a) => (date(a) > m ? date(a) : m), '');
      const dy = y.annonces.reduce((m, a) => (date(a) > m ? date(a) : m), '');
      return dy.localeCompare(dx);
    });
}

/** Les annonces de tous mes secteurs ensemble (la carte « Mes nouvelles adresses »). */
export function annoncesAProspecter(
  annonces: readonly Annonce[],
  zones: readonly Zone[],
  profileId: string,
): GroupeAnnonce[] {
  return ordonner(
    annonces.filter((a) => aProspecter(a) && dansMonSecteur(a, zones, { directeur: false, profileId })),
  );
}

export type SecteurAProspecter = {
  zone: Zone;
  /** Secteur à mon nom. */
  mien: boolean;
  groupes: GroupeAnnonce[];
};

/**
 * La Liste, secteur par secteur : chacun de mes secteurs, même vide, puis les
 * autres secteurs de l'agence qui ont des annonces. Un secteur sans contour ni
 * rue n'y figure pas.
 */
export function secteursAProspecter(
  annonces: readonly Annonce[],
  zones: readonly Zone[],
  profileId: string,
): SecteurAProspecter[] {
  const parZone = new Map<string, Annonce[]>();
  for (const a of annonces) {
    if (!aProspecter(a)) continue;
    const zone = zoneDeLAnnonce(a, zones);
    if (!zone) continue;
    const liste = parZone.get(zone.id) ?? [];
    liste.push(a);
    parZone.set(zone.id, liste);
  }
  return trierSecteurs(zones.filter(secteurDefini), profileId)
    .map((zone) => ({
      zone,
      mien: zone.assignedTo === profileId,
      groupes: ordonner(parZone.get(zone.id) ?? []),
    }))
    .filter((s) => s.mien || s.groupes.length > 0);
}
