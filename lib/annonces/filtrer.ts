import type { MapLayerState } from '@/lib/carte/layers';
import type { Zone } from '@/lib/zones/types';
import { baisseCumulee, joursEnLigne, regrouperAnnonces } from './presenter';
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
};

/** Tous les filtres sauf « Mon secteur ». */
function passeFiltres(a: Annonce, r: ReglagesAnnonces, maintenant: Date): boolean {
  if (r.annoncesVendeur !== 'tous' && a.typeVendeur !== r.annoncesVendeur) return false;
  switch (r.annoncesStatut) {
    case 'retirees':
      if (a.statut !== 'retiree') return false;
      break;
    case 'baisse':
      if (a.statut !== 'active' || baisseCumulee(a) == null) return false;
      break;
    case 'nouvelles': {
      if (a.statut !== 'active') return false;
      const jours = joursEnLigne(a, maintenant);
      if (jours == null || jours > JOURS_NOUVELLE) return false;
      break;
    }
    default:
      if (a.statut !== 'active') return false;
  }
  return true;
}

export function filtrerAnnonces(
  annonces: readonly Annonce[],
  reglages: ReglagesAnnonces,
  _zones: readonly Zone[],
  qui: Qui,
  maintenant = new Date(),
): Annonce[] {
  return annonces.filter((a) => retenue(a, reglages, qui, maintenant));
}

function retenue(
  a: Annonce,
  reglages: ReglagesAnnonces,
  qui: Qui,
  maintenant: Date,
): boolean {
  if (!passeFiltres(a, reglages, maintenant)) return false;
  if (qui.zoneCadree) return dansLaZone(a, qui.zoneCadree);
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
  reglages: ReglagesAnnonces,
  zones: readonly Zone[],
  qui: Qui,
  maintenant = new Date(),
): BilanAnnonces {
  const base = annonces.filter((a) => passeFiltres(a, reglages, maintenant));
  const secteur = base.filter((a) => dansMonSecteur(a, zones, qui));
  const cadre = qui.zoneCadree ? base.filter((a) => dansLaZone(a, qui.zoneCadree!)) : null;
  const retenus = regrouperAnnonces(cadre ?? base);
  const surCarte = retenus.filter(placee).length;
  return {
    surCarte,
    sansPosition: retenus.length - surCarte,
    tousSecteurs: regrouperAnnonces(base).filter(placee).length,
    dansMonSecteur: regrouperAnnonces(secteur).filter(placee).length,
  };
}
