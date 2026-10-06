import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { lireNumeros, lireVoies } from './ban-voie';

describe('voies de la BAN', () => {
  it('ne garde que les voies, avec code postal', () => {
    const voies = lireVoies({
      features: [
        {
          geometry: { coordinates: [2.3755, 48.8651] },
          properties: { type: 'street', id: '75111_6858', name: 'Rue Oberkampf', postcode: '75011', city: 'Paris' },
        },
        {
          geometry: { coordinates: [2.37, 48.86] },
          properties: { type: 'housenumber', id: '75111_6858_00008', name: '8 Rue Oberkampf', postcode: '75011' },
        },
      ],
    });
    assert.deepEqual(voies, [
      { id: '75111_6858', nom: 'Rue Oberkampf', codePostal: '75011', commune: 'Paris', latitude: 48.8651, longitude: 2.3755 },
    ]);
  });

  it('lit les numéros situés et leurs parcelles', () => {
    const numeros = lireNumeros({
      numeros: [
        { numero: 1, suffixe: null, position: { coordinates: [2.3674, 48.8627] }, parcelles: ['75111000AO0070'] },
        { numero: 3, suffixe: 'bis', position: { coordinates: [2.3675, 48.8628] } },
        { numero: 0, position: { coordinates: [2.36, 48.86] } },
        { numero: 5 },
      ],
    });
    assert.deepEqual(numeros, [
      { numero: 1, suffixe: null, longitude: 2.3674, latitude: 48.8627, parcelles: ['75111000AO0070'] },
      { numero: 3, suffixe: 'bis', longitude: 2.3675, latitude: 48.8628, parcelles: [] },
    ]);
  });
});
