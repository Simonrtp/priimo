import { JOURS_NOUVELLE } from '@/lib/annonces/filtrer';
import { baisseCumulee, joursEnLigne } from '@/lib/annonces/presenter';
import type { Annonce } from '@/lib/annonces/types';
import type { AnnoncePorte } from './generer';

/** Annonces en baisse de prix, ou mises en ligne depuis une semaine, assez placées pour une porte. */
export function portesDesAnnonces(annonces: readonly Annonce[], maintenant: Date): AnnoncePorte[] {
  const portes: AnnoncePorte[] = [];
  for (const annonce of annonces) {
    if (annonce.statut !== 'active' || annonce.latitude == null || annonce.longitude == null) continue;
    const baisse = baisseCumulee(annonce);
    const jours = joursEnLigne(annonce, maintenant);
    const nouvelle = jours != null && jours <= JOURS_NOUVELLE;
    if (baisse == null && !nouvelle) continue;
    const brut =
      baisse != null
        ? (annonce.derniereVueLe ?? annonce.publieeLe ?? annonce.premiereVueLe)
        : (annonce.publieeLe ?? annonce.premiereVueLe);
    const depuis = brut?.slice(0, 10);
    if (!depuis) continue;
    const adresse =
      annonce.adresse?.trim() ||
      [annonce.adresseNumero, annonce.adresseVoie, annonce.codePostal, annonce.ville].filter(Boolean).join(' ').trim();
    if (!adresse) continue;
    portes.push({
      id: annonce.id,
      banId: null,
      adresse,
      codePostal: annonce.codePostal,
      latitude: annonce.latitude,
      longitude: annonce.longitude,
      parcelleId: annonce.parcelleIds[0] ?? null,
      motif: baisse != null ? 'baisse' : 'nouvelle',
      baissePourcent: baisse,
      depuis,
    });
  }
  return portes;
}
