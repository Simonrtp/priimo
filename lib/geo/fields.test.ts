import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { BanGeocodeHit } from './ban';
import { choisirAdresseDictee } from './fields';

const PARIS_20 = { latitude: 48.8635, longitude: 2.401 };

function hit(adresse: string, score: number, lat: number, lng: number): BanGeocodeHit {
  return { ban_id: adresse, lat, lng, adresse_normalisee: adresse, score };
}

describe('choisirAdresseDictee', () => {
  it('garde la rue du secteur quand la dictée l’a mal orthographiée', () => {
    const secteur = hit('27 Rue Alphonse Penaud 75020 Paris', 0.78, 48.868, 2.406);
    const france = hit('Rue Alphonse Allais 13170 Les Pennes-Mirabeau', 0.48, 43.41, 5.31);
    assert.equal(choisirAdresseDictee(secteur, france, PARIS_20), secteur);
  });

  it('écarte une rue au nom proche à l’autre bout de la France', () => {
    const secteur = hit('10 Rue Alphonse Penaud 75020 Paris', 0.57, 48.868, 2.406);
    const france = hit('10 Rue Alphonse Mann 62360 Saint-Étienne-au-Mont', 0.59, 50.68, 1.63);
    assert.equal(choisirAdresseDictee(secteur, france, PARIS_20), secteur);
  });

  it('garde une vraie adresse hors secteur quand elle est bien dite', () => {
    const secteur = hit('4 Rue d’Avron 75020 Paris', 0.5, 48.852, 2.397);
    const france = hit('4 Rue d’Aligre 75012 Paris', 0.97, 48.848, 2.378);
    assert.equal(choisirAdresseDictee(secteur, france, PARIS_20), france);
  });

  it('se contente de la France sans territoire connu', () => {
    const france = hit('12 Rue de la Paix 75002 Paris', 0.95, 48.869, 2.331);
    assert.equal(choisirAdresseDictee(null, france, null), france);
    assert.equal(choisirAdresseDictee(null, null, PARIS_20), null);
  });
});
