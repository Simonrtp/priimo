/**
 * « Mes nouvelles adresses » (accueil) : les annonces de particuliers trouvées
 * par le balayage de nuit dans le secteur du négociateur — pas de toute
 * l'agence. Même règle d'appartenance que les leads (`dansMonSecteur`). Pur.
 *
 * Depuis le 25/10/2026, la carte ne montre plus les leads de l'ancien
 * pipeline (DVF + scoring, supprimés) : un clic ouvre l'annonce.
 */
import type { AdresseLivree } from '@/components/dashboard/accueil/NouvellesAdresses';
import type { Zone } from '@/lib/zones/types';
import { libellePortail } from './presenter';
import { dansMonSecteur } from './secteur';
import type { Annonce } from './types';

/** Six lignes : de quoi remplir la carte ; « Voir tout » ouvre les annonces. */
const LIGNES = 6;

const euros = (n: number) => `${new Intl.NumberFormat('fr-FR').format(Math.round(n))} €`;

/** La plus récente d'abord : publiée sur le portail, sinon vue la première fois. */
function date(a: Annonce): string {
  return a.publieeLe ?? a.premiereVueLe ?? '';
}

/** Adresse retrouvée, sinon la rue seule, sinon le quartier. */
function libelle(a: Annonce): string {
  if (a.adresse) return a.adresse;
  if (a.adresseVoie) return [a.adresseVoie, a.codePostal].filter(Boolean).join(' ');
  return [a.quartier ?? 'Secteur', a.codePostal].filter(Boolean).join(' · ');
}

function sousTitre(a: Annonce): string {
  return [libellePortail(a.portail), a.prix != null ? euros(a.prix) : null, a.surface != null ? `${Math.round(a.surface)} m²` : null]
    .filter(Boolean)
    .join(' · ');
}

function signaux(a: Annonce): string[] {
  const s: string[] = [];
  if (!a.adresse) s.push('Adresse à confirmer');
  if (a.prix != null && a.prixInitial != null && a.prix < a.prixInitial) s.push('Prix en baisse');
  if (a.pieces != null) s.push(`${a.pieces} pièce${a.pieces > 1 ? 's' : ''}`);
  if (a.dpe) s.push(`DPE ${a.dpe}`);
  if (a.refusDemarchage) s.push('Refuse les appels');
  return s;
}

export function nouvellesAdressesDuSecteur(
  annonces: readonly Annonce[],
  zones: readonly Zone[],
  profileId: string,
): { adresses: AdresseLivree[]; total: number; sansSecteur: boolean } {
  const sansSecteur = !zones.some((z) => z.assignedTo === profileId);
  const miennes = annonces
    .filter((a) => a.statut === 'active' && a.typeVendeur === 'particulier' && dansMonSecteur(a, zones, { directeur: false, profileId }))
    .sort((a, b) => date(b).localeCompare(date(a)));
  return {
    sansSecteur,
    total: miennes.length,
    adresses: miennes.slice(0, LIGNES).map((a) => ({
      id: a.id,
      address: libelle(a),
      city: sousTitre(a),
      score: 0,
      mainSignalLabel: null,
      ownerName: null,
      signaux: signaux(a),
      href: `/dashboard/annonces?annonce=${a.id}`,
      photo: a.photos?.[0] ?? null,
    })),
  };
}
