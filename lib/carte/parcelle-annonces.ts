import { baisseCumulee, libellePortail, regrouperAnnonces } from '@/lib/annonces/presenter';
import type { Annonce } from '@/lib/annonces/types';
import type { ParcelleAnnonce } from './parcelle';

/** Une annonce retirée reste sur la fiche ce temps-là : un vendeur qui n'a pas vendu. */
export const JOURS_RETIREE_VISIBLE = 90;
const MAX_ANNONCES = 6;

function rang(a: Annonce): number {
  return (a.statut === 'active' ? 0 : 2) + (a.typeVendeur === 'particulier' ? 0 : 1);
}

/** Les portails du logement, sans doublon, le plus récent d'abord. */
function clesPortail(annonces: readonly Annonce[]): string[] {
  const vus = new Set<string>();
  const cles: string[] = [];
  for (const a of annonces) {
    if (vus.has(a.portail)) continue;
    vus.add(a.portail);
    cles.push(a.portail);
  }
  return cles;
}

/** Un logement par ligne (plusieurs portails = une ligne), en vente d'abord, particuliers devant. */
export function annoncesDeLaParcelle(annonces: readonly Annonce[], maintenant = new Date()): ParcelleAnnonce[] {
  const limite = maintenant.getTime() - JOURS_RETIREE_VISIBLE * 86_400_000;
  const retenues = annonces.filter((a) => {
    if (a.statut === 'active') return true;
    const le = Date.parse(a.retireeLe ?? a.derniereVueLe ?? '');
    return Number.isFinite(le) && le >= limite;
  });
  return regrouperAnnonces(retenues)
    .map((g) => ({
      a: g.annonces.find((x) => x.statut === 'active') ?? g.principale,
      portails: clesPortail(g.annonces),
    }))
    .sort((x, y) => rang(x.a) - rang(y.a) || (y.a.derniereVueLe ?? '').localeCompare(x.a.derniereVueLe ?? ''))
    .slice(0, MAX_ANNONCES)
    .map(({ a, portails }) => ({
      id: a.id,
      url: a.url,
      portail: libellePortail(a.portail),
      portails,
      particulier: a.typeVendeur === 'particulier',
      agence: a.agenceNom,
      prix: a.prix,
      baisse: a.statut === 'active' ? baisseCumulee(a) : null,
      pieces: a.pieces,
      surface: a.surface,
      etage: a.etage,
      dpe: a.dpe,
      retiree: a.statut === 'retiree',
    }));
}
