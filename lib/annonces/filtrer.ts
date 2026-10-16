import type { MapLayerState } from '@/lib/carte/layers';
import type { Zone } from '@/lib/zones/types';
import { baisseCumulee } from './presenter';
import { dansMonSecteur } from './secteur';
import type { Annonce } from './types';

export function filtrerAnnonces(
  annonces: readonly Annonce[],
  layers: Pick<
    MapLayerState,
    | 'annoncesActives'
    | 'annoncesRetirees'
    | 'annoncesParticuliers'
    | 'annoncesBaisse'
    | 'annoncesMonSecteur'
    | 'annoncesDpe'
    | 'annoncesPieces'
    | 'annoncesPrixMax'
  >,
  zones: readonly Zone[],
  opts: { directeur: boolean; profileId: string },
): Annonce[] {
  const voitActives = layers.annoncesActives || layers.annoncesBaisse;
  const voitRetirees = layers.annoncesRetirees;
  if (!voitActives && !voitRetirees) return [];
  const prixMax = Number(layers.annoncesPrixMax);
  return annonces.filter((a) => {
    if (a.statut === 'active' && !voitActives) return false;
    if (a.statut === 'retiree' && !voitRetirees) return false;
    if (layers.annoncesParticuliers && a.typeVendeur !== 'particulier') return false;
    if (layers.annoncesBaisse && baisseCumulee(a) == null) return false;
    if (layers.annoncesDpe && a.dpe !== layers.annoncesDpe) return false;
    if (layers.annoncesPieces && String(a.pieces ?? '') !== layers.annoncesPieces) return false;
    if (layers.annoncesPrixMax && (a.prix == null || !Number.isFinite(prixMax) || a.prix > prixMax)) return false;
    if (layers.annoncesMonSecteur && !dansMonSecteur(a, zones, opts)) return false;
    return true;
  });
}
