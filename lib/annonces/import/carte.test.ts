import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ligneAdmise } from './carte';

describe('ligneAdmise', () => {
  it('une rue seule, incertaine, se garde comme voie : la base refuse une adresse non affirmée', () => {
    assert.deepEqual(ligneAdmise({ confiance: 'incertaine', adresse: 'Rue des Pyrénées 75020 Paris', adresse_numero: null, adresse_voie: null }), {
      confiance: 'incertaine',
      adresse: null,
      adresse_numero: null,
      adresse_voie: 'Rue des Pyrénées',
    });
  });
  it('une adresse affirmée reste telle quelle', () => {
    const ligne = { confiance: 'certaine', adresse: '91 Rue des Pyrénées 75020 Paris', adresse_numero: '91', adresse_voie: 'Rue des Pyrénées' };
    assert.equal(ligneAdmise(ligne), ligne);
  });
  it('incertaine sans adresse : rien à faire', () => {
    const ligne = { confiance: 'incertaine', adresse: null };
    assert.equal(ligneAdmise(ligne), ligne);
  });
});
