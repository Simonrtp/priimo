import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Annonce } from '@/lib/annonces/types';
import { portesDesAnnonces } from './portes';

const MAINTENANT = new Date('2026-10-18T12:00:00Z');

function annonce(over: Partial<Annonce> = {}): Annonce {
  return {
    id: 'a1',
    idPortail: 'x',
    portail: 'pap',
    url: 'https://example.test/a1',
    typeVendeur: 'particulier',
    agenceNom: null,
    refusDemarchage: false,
    statut: 'active',
    publieeLe: '2026-10-16T10:00:00Z',
    premiereVueLe: '2026-10-16T10:00:00Z',
    derniereVueLe: '2026-10-17T10:00:00Z',
    retireeLe: null,
    typeBien: 'appartement',
    titre: null,
    prixInitial: 400_000,
    prix: 400_000,
    surface: 50,
    pieces: 2,
    etage: '3',
    dpe: 'E',
    codePostal: '75020',
    ville: 'Paris',
    quartier: null,
    confiance: 'probable',
    localisationPrecision: 'logement',
    adresse: '10 Rue des Pyrénées 75020 Paris',
    adresseNumero: '10',
    adresseVoie: 'Rue des Pyrénées',
    parcelleIds: ['p1'],
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

describe('portesDesAnnonces', () => {
  it('garde une baisse et une mise en ligne de la semaine, pas une annonce ancienne au même prix', () => {
    const portes = portesDesAnnonces(
      [
        annonce({ id: 'baisse', prix: 360_000, prixInitial: 400_000 }),
        annonce({ id: 'nouvelle', publieeLe: '2026-10-14T10:00:00Z', premiereVueLe: '2026-10-14T10:00:00Z' }),
        annonce({ id: 'ancienne', publieeLe: '2026-08-01T10:00:00Z', premiereVueLe: '2026-08-01T10:00:00Z' }),
        annonce({ id: 'sans-lieu', latitude: null, longitude: null, publieeLe: '2026-10-17T10:00:00Z' }),
      ],
      MAINTENANT,
    );
    assert.deepEqual(
      portes.map((p) => p.motif),
      ['baisse', 'nouvelle'],
    );
    assert.equal(portes[0]?.baissePourcent, 10);
    assert.equal(portes[0]?.parcelleId, 'p1');
  });
});
