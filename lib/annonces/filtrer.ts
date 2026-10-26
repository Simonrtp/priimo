import type { MapLayerState } from '@/lib/carte/layers';
import type { Zone } from '@/lib/zones/types';
import { regrouperAnnonces } from './presenter';
import { dansLaZone, dansMonSecteur } from './secteur';
import type { Annonce, GroupeAnnonce } from './types';

/** « Nouvelles » : en ligne depuis une semaine au plus. */
export const JOURS_NOUVELLE = 7;

type ReglagesAnnonces = Pick<MapLayerState, 'annoncesVendeur' | 'annoncesStatut'>;

type Qui = {
  directeur: boolean;
  profileId: string;
  /** Secteur cadré par le bouton « Secteur » en haut du panneau. */
  zoneCadree?: Zone | null;
  /** Directeur : tous les secteurs des agents, d'un coup. */
  zonesCadrees?: readonly Zone[] | null;
};

export function filtrerAnnonces(
  annonces: readonly Annonce[],
  _reglages: ReglagesAnnonces,
  _zones: readonly Zone[],
  qui: Qui,
  _maintenant = new Date(),
): Annonce[] {
  return annonces.filter((a) => dansLeCadre(a, qui));
}

/**
 * « Voir mes annonces » sur la carte : les annonces de particuliers actives de
 * mon secteur — celui de chaque agent pour le directeur —, dans le secteur
 * cadré en haut du panneau s'il y en a un. Les mêmes que la Liste.
 */
export function mesAnnoncesSurCarte(annonces: readonly Annonce[], zones: readonly Zone[], qui: Qui): Annonce[] {
  return annonces.filter(
    (a) =>
      a.statut === 'active' &&
      a.typeVendeur === 'particulier' &&
      dansMonSecteur(a, zones, { directeur: qui.directeur, profileId: qui.profileId }) &&
      dansLeCadre(a, qui),
  );
}

function dansLeCadre(a: Annonce, qui: Qui): boolean {
  if (qui.zoneCadree) return dansLaZone(a, qui.zoneCadree);
  if (qui.zonesCadrees && qui.zonesCadrees.length > 0) {
    return qui.zonesCadrees.some((zone) => dansLaZone(a, zone));
  }
  return true;
}

function placee(g: GroupeAnnonce): boolean {
  return g.principale.latitude != null && g.principale.longitude != null;
}

export type BilanAnnonces = {
  /** Logements affichés sur la carte avec les réglages en cours. */
  surCarte: number;
  /** Logements retenus mais pas encore localisés : invisibles sur la carte. */
  sansPosition: number;
  /** Logements placés qui passent les filtres, secteur ou non. */
  tousSecteurs: number;
  /** Dont ceux de mon secteur. */
  dansMonSecteur: number;
};

/** Les compteurs du panneau, calculés sur les mêmes règles que la carte. */
export function bilanAnnonces(
  annonces: readonly Annonce[],
  _reglages: ReglagesAnnonces,
  zones: readonly Zone[],
  qui: Qui,
  _maintenant = new Date(),
): BilanAnnonces {
  const base = annonces;
  const secteur = base.filter((a) => dansMonSecteur(a, zones, qui));
  const cadre =
    qui.zoneCadree || (qui.zonesCadrees && qui.zonesCadrees.length > 0)
      ? base.filter((a) => dansLeCadre(a, qui))
      : null;
  const retenus = regrouperAnnonces(cadre ?? base);
  const surCarte = retenus.filter(placee).length;
  return {
    surCarte,
    sansPosition: retenus.length - surCarte,
    tousSecteurs: regrouperAnnonces(base).filter(placee).length,
    dansMonSecteur: regrouperAnnonces(secteur).filter(placee).length,
  };
}
