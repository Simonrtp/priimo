import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Zone } from '@/lib/zones/types';
import { adresseVerifiee, annoncesAProspecter } from './liste-prospection';
import type { Annonce } from './types';

const zone: Zone = {
  id: 'z1',
  agencyId: 'ag',
  nom: 'Est',
  couleur: '#1A2A56',
  assignedTo: 'nego',
  joursSemaine: [],
  actif: true,
  verrouillee: false,
  regles: [{ id: 'r1', zoneId: 'z1', inclusion: true, type: 'code_postal', valeur: { code_postal: '75020' } }],
};

function annonce(over: Partial<Annonce> = {}): Annonce {
  return {
    id: 'a',
    idPortail: '1',
    portail: 'pap',
    url: 'https://www.pap.fr/annonces/appartement-paris-20e-r1',
    typeVendeur: 'particulier',
    agenceNom: null,
    refusDemarchage: false,
    statut: 'active',
    publieeLe: '2026-10-20T08:00:00Z',
    premiereVueLe: '2026-10-25T01:00:00Z',
    derniereVueLe: '2026-10-25T01:00:00Z',
    retireeLe: null,
    typeBien: 'appartement',
    titre: null,
    prixInitial: null,
    prix: 415000,
    surface: 37,
    pieces: 2,
    etage: null,
    dpe: 'C',
    codePostal: '75020',
    ville: 'Paris',
    quartier: null,
    confiance: 'certaine',
    localisationPrecision: 'logement',
    adresse: '91 Rue des Pyrénées 75020 Paris',
    adresseNumero: '91',
    adresseVoie: 'Rue des Pyrénées',
    parcelleIds: [],
    numeroDpe: null,
    complementDpe: null,
    latitude: 48.86,
    longitude: 2.39,
    logementCle: null,
    scoreLocalisation: null,
    raisonsLocalisation: [],
    photos: [],
    ...over,
  };
}

describe('annoncesAProspecter', () => {
  it('un logement sur PAP et SeLoger compte une fois, l’annonce qui porte l’adresse devant', () => {
    const g = annoncesAProspecter(
      [
        annonce({ id: 'seloger', portail: 'seloger', logementCle: 'L1', confiance: 'incertaine', adresse: null, derniereVueLe: '2026-10-25T02:00:00Z' }),
        annonce({ id: 'pap', logementCle: 'L1' }),
      ],
      [zone],
      { profileId: 'nego', portee: 'mien' },
    );
    assert.equal(g.length, 1);
    assert.equal(g[0]?.principale.id, 'pap');
    assert.equal(g[0]?.annonces.length, 2);
  });

  it('mon secteur seulement, sauf « toute l’agence » ; jamais une annonce retirée ou d’agence', () => {
    const annonces = [
      annonce({ id: 'chez-moi' }),
      annonce({ id: 'ailleurs', codePostal: '75011' }),
      annonce({ id: 'retiree', statut: 'retiree' }),
      annonce({ id: 'pro', typeVendeur: 'professionnel' }),
    ];
    assert.deepEqual(annoncesAProspecter(annonces, [zone], { profileId: 'nego', portee: 'mien' }).map((g) => g.cle), ['chez-moi']);
    assert.deepEqual(
      annoncesAProspecter(annonces, [zone], { profileId: 'nego', portee: 'agence' }).map((g) => g.cle).sort(),
      ['ailleurs', 'chez-moi'],
    );
  });

  it('la rue seule n’est pas une adresse vérifiée', () => {
    assert.equal(adresseVerifiee(annonce()), true);
    assert.equal(adresseVerifiee(annonce({ confiance: 'incertaine', adresse: null })), false);
  });
});
