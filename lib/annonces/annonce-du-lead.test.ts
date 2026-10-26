import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { annonceDuLead } from './annonce-du-lead';
import type { Annonce } from './types';

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
    publieeLe: null,
    premiereVueLe: '2026-10-25T01:00:00Z',
    derniereVueLe: '2026-10-25T01:00:00Z',
    retireeLe: null,
    typeBien: 'appartement',
    titre: null,
    prixInitial: null,
    prix: 620000,
    surface: 69,
    pieces: 3,
    etage: '4',
    dpe: 'C',
    codePostal: '75020',
    ville: 'Paris',
    quartier: null,
    confiance: 'certaine',
    localisationPrecision: 'logement',
    adresse: '25 Rue du Surmelin 75020 Paris',
    adresseNumero: '25',
    adresseVoie: 'Rue du Surmelin',
    parcelleIds: [],
    numeroDpe: null,
    complementDpe: null,
    latitude: 48.86,
    longitude: 2.4,
    logementCle: null,
    scoreLocalisation: null,
    raisonsLocalisation: [],
    photos: [],
    ...over,
  };
}

const carte = {
  address: '25 Rue du Surmelin',
  postalCode: '75020',
  surfaceM2: 69,
  rooms: 3,
  bien: { id: 'b', propertyType: 'Appartement', surfaceM2: 69, rooms: 3, price: 620000, photo: null },
};

describe('annonceDuLead', () => {
  it('retrouve l’annonce par l’adresse', () => {
    assert.equal(annonceDuLead(carte, [annonce({ id: 'x', adresse: '3 Rue Oberkampf 75011 Paris', adresseNumero: '3', adresseVoie: 'Rue Oberkampf', codePostal: '75011' }), annonce({ id: 'ici' })])?.annonce.id, 'ici');
  });

  it('plusieurs annonces dans l’immeuble : le prix, la surface et les pièces départagent', () => {
    const r = annonceDuLead(carte, [
      annonce({ id: 'petit', prix: 210000, surface: 23, pieces: 1 }),
      annonce({ id: 'bon' }),
    ]);
    assert.equal(r?.annonce.id, 'bon');
  });

  it('les portails du même logement suivent, et une adresse inconnue ne donne rien', () => {
    const r = annonceDuLead(carte, [annonce({ id: 'pap', logementCle: 'L' }), annonce({ id: 'sl', portail: 'seloger', logementCle: 'L' })]);
    assert.deepEqual(r?.soeurs.map((a) => a.id).sort(), ['pap', 'sl']);
    assert.equal(annonceDuLead({ ...carte, address: '99 Rue Inconnue' }, [annonce()]), null);
  });

  it('un autre code postal ne se confond pas', () => {
    assert.equal(annonceDuLead(carte, [annonce({ codePostal: '75011' })]), null);
  });
});
