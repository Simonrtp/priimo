import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { appliquerChoix } from './lire';
import { lireAdressesPossibles, possibleChoisie, type Annonce } from './types';

const POSSIBLES = [
  { adresse: '8 Passage du Jeu de Boules 75011 Paris', latitude: 48.8656, longitude: 2.3674, raison: 'Au point de la carte de l’annonce' },
  { adresse: '82 Rue de la Folie-Méricourt 75011 Paris', latitude: 48.8663, longitude: 2.3693, raison: 'Même DPE que l’annonce (48 m² · classe E), à 208 m du point' },
];

describe('adresses possibles et adresse choisie (23/10/2026)', () => {
  it('lit la raison de chaque adresse possible, et ignore une valeur mal formée', () => {
    assert.deepEqual(lireAdressesPossibles([...POSSIBLES, { adresse: 'sans point' }, null]), POSSIBLES);
    // Avant les raisons : une adresse sans raison reste lisible.
    assert.deepEqual(lireAdressesPossibles([{ adresse: 'A', latitude: 1, longitude: 2 }]), [{ adresse: 'A', latitude: 1, longitude: 2 }]);
  });

  it('n’accepte comme choix que l’une des adresses possibles', () => {
    assert.equal(possibleChoisie(POSSIBLES, '82 Rue de la Folie-Méricourt 75011 Paris'), POSSIBLES[1]);
    assert.equal(possibleChoisie(POSSIBLES, '1 Rue Inventée 75011 Paris'), null);
    assert.equal(possibleChoisie(POSSIBLES, null), null);
  });

  it('l’adresse choisie remplace l’adresse et le point ; les possibles restent pour revenir en arrière', () => {
    const annonce = { id: 'a1', adresse: null, latitude: 48.86, longitude: 2.368, confiance: 'incertaine', adressesPossibles: POSSIBLES } as unknown as Annonce;
    const choisie = appliquerChoix(annonce, POSSIBLES[1]!);
    assert.equal(choisie.adresse, '82 Rue de la Folie-Méricourt 75011 Paris');
    assert.deepEqual([choisie.latitude, choisie.longitude], [48.8663, 2.3693]);
    assert.equal(choisie.adressesPossibles?.length, 2);
    assert.equal(choisie.adresseChoisie, POSSIBLES[1]);
    assert.equal(appliquerChoix(annonce, null), annonce);
  });
});
