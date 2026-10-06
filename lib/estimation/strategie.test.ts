import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parserStrategie, promptStrategie } from './strategie';

describe('stratégie de prix', () => {
  it('ne demande que les faits saisis', () => {
    const p = promptStrategie({
      propertyType: 'maison',
      surfaceM2: 140,
      rooms: 6,
      floor: null,
      anneeConstruction: 1978,
      dpeClass: 'F',
      conditionRating: 2,
      ascenseur: null,
      balconTerrasse: false,
      piscine: true,
      terrainM2: 800,
      annexes: [{ libelle: 'Garage' }],
      commentairesPublics: 'Toiture récente.',
    });
    assert.match(p, /DPE : F/);
    assert.match(p, /Piscine/);
    const faits = p.split('Faits :')[1] ?? '';
    assert.doesNotMatch(faits, /école|vue mer/i);
  });

  it('parse le JSON Mistral sans inventer', () => {
    const out = parserStrategie('Voici {"forces":["Piscine"],"faiblesses":["DPE F"]}');
    assert.deepEqual(out.forces, ['Piscine']);
    assert.deepEqual(out.faiblesses, ['DPE F']);
    assert.deepEqual(parserStrategie('rien'), { forces: [], faiblesses: [] });
  });
});
