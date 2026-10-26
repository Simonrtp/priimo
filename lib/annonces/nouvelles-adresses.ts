/**
 * « Mes nouvelles adresses » (accueil) : les annonces de particuliers trouvées
 * par le balayage de nuit dans les secteurs du négociateur — pas de toute
 * l'agence. Même sélection que la Liste de Prospection, où mène « Voir tout ».
 * Pur.
 */
import type { AdresseLivree } from '@/components/dashboard/accueil/NouvellesAdresses';
import type { Zone } from '@/lib/zones/types';
import { annoncesAProspecter } from './liste-prospection';
import { secteurDefini } from '@/lib/carte/emprise';
import { libellePortail } from './presenter';
import type { Annonce } from './types';

/** Six lignes : de quoi remplir la carte ; « Voir tout » ouvre la Liste. */
const LIGNES = 6;

const euros = (n: number) => `${new Intl.NumberFormat('fr-FR').format(Math.round(n))} €`;

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
): { adresses: AdresseLivree[]; total: number; sansSecteur: boolean; secteurs: number } {
  const miennes = annoncesAProspecter(annonces, zones, profileId).map((g) => g.principale);
  const secteurs = zones.filter((z) => z.assignedTo === profileId && secteurDefini(z)).length;
  return {
    sansSecteur: secteurs === 0,
    secteurs,
    total: miennes.length,
    adresses: miennes.slice(0, LIGNES).map((a) => ({
      id: a.id,
      address: libelle(a),
      city: sousTitre(a),
      score: 0,
      mainSignalLabel: null,
      ownerName: null,
      signaux: signaux(a),
      href: `/dashboard/prospection?vue=liste&annonce=${a.id}`,
      photo: a.photos?.[0] ?? null,
    })),
  };
}
