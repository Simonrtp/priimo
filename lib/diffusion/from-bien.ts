import type { Bien } from '@/types/bien';
import type { Annonce } from './types';

export function bienToAnnonce(bien: Bien, agenceNom: string | null = null): Annonce {
  return {
    reference: bien.id,
    titre: bien.listingTitle,
    description: bien.listingDescription,
    type: bien.propertyType,
    adresse: bien.address,
    codePostal: bien.postalCode,
    ville: bien.city,
    prix: bien.price,
    surfaceM2: bien.surfaceM2,
    pieces: bien.rooms,
    photos: bien.photos,
    dpeLettre: bien.dpeLettre,
    dpeKwh: bien.dpeKwh,
    gesLettre: bien.gesLettre,
    gesKgCo2: bien.gesKgCo2,
    dpeVierge: bien.dpeVierge,
    dpeDate: bien.dpeDate,
    mandatStatut: bien.mandatStatut,
    mandatNumero: bien.mandatNumero,
    mandatDate: bien.mandatDate,
    honorairesMontant: bien.honorairesMontant,
    honorairesACharge: bien.honorairesACharge,
    honorairesPourcent: bien.honorairesPourcent,
    agenceNom,
  };
}
