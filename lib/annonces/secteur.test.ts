import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Zone } from '@/lib/zones/types';
import { dansMonSecteur, zoneDeLAnnonce } from './secteur';
import type { Annonce } from './types';

function zone(over: Partial<Zone> = {}): Zone {
  return {
    id: 'z1',
    agencyId: 'ag',
    nom: 'Est',
    couleur: '#1A2A56',
    assignedTo: 'nego',
    joursSemaine: [],
    actif: true,
    verrouillee: false,
    regles: [
      {
        id: 'r1',
        zoneId: 'z1',
        inclusion: true,
        type: 'code_postal',
        valeur: { code_postal: '75020' },
      },
    ],
    ...over,
  };
}

function annonce(over: Partial<Annonce> = {}): Annonce {
  return {
    id: 'a',
    idPortail: null,
    portail: 'pap',
    url: 'https://example.test',
    typeVendeur: 'particulier',
    agenceNom: null,
    refusDemarchage: false,
    statut: 'active',
    publieeLe: null,
    premiereVueLe: null,
    derniereVueLe: null,
    retireeLe: null,
    typeBien: null,
    titre: null,
    prixInitial: null,
    prix: 100,
    surface: null,
    pieces: null,
    etage: null,
    dpe: null,
    codePostal: '75020',
    ville: 'Paris',
    quartier: null,
    confiance: 'certaine',
    localisationPrecision: 'immeuble',
    adresse: null,
    adresseNumero: '12',
    adresseVoie: 'rue Orfila',
    parcelleIds: ['75120000CC0107'],
    numeroDpe: null,
    complementDpe: null,
    latitude: 48.86,
    longitude: 2.39,
    logementCle: null,
    scoreLocalisation: null,
    raisonsLocalisation: [],
    ...over,
  };
}

describe('zone de l’annonce', () => {
  it('retient le titulaire du code postal', () => {
    const z = zone();
    assert.equal(zoneDeLAnnonce(annonce(), [z])?.id, 'z1');
    assert.equal(dansMonSecteur(annonce(), [z], { directeur: false, profileId: 'nego' }), true);
    assert.equal(dansMonSecteur(annonce(), [z], { directeur: false, profileId: 'autre' }), false);
    assert.equal(dansMonSecteur(annonce(), [z], { directeur: true, profileId: 'dir' }), true);
  });

  it('laisse hors secteur une annonce d’un autre code', () => {
    assert.equal(zoneDeLAnnonce(annonce({ codePostal: '75019' }), [zone()]), null);
  });
});
