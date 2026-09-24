import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  COULEUR_ETAPE,
  COULEUR_STATUT,
  couleurEtatPipeline,
} from './lead-etat-couleur';

describe('lead-etat-couleur', () => {
  it('chaque étape pipeline a une couleur distincte', () => {
    const couleurs = Object.values(COULEUR_ETAPE);
    assert.equal(new Set(couleurs).size, couleurs.length);
    assert.equal(couleurs.length, 6);
  });

  it('chaque statut a une couleur distincte', () => {
    const couleurs = Object.values(COULEUR_STATUT);
    assert.equal(new Set(couleurs).size, couleurs.length);
    assert.equal(couleurs.length, 6);
  });

  it('lit la couleur par clé d’étape, pas par type', () => {
    assert.equal(couleurEtatPipeline({ cle: 'pris', type: 'entree' }), COULEUR_ETAPE.pris);
    assert.equal(couleurEtatPipeline({ cle: 'contacte', type: 'intermediaire' }), COULEUR_ETAPE.contacte);
    assert.equal(couleurEtatPipeline({ cle: 'rendez_vous', type: 'intermediaire' }), COULEUR_ETAPE.rendez_vous);
    assert.equal(couleurEtatPipeline({ cle: 'estimation', type: 'intermediaire' }), COULEUR_ETAPE.estimation);
    assert.notEqual(
      couleurEtatPipeline({ cle: 'rendez_vous', type: 'intermediaire' }),
      couleurEtatPipeline({ cle: 'estimation', type: 'intermediaire' }),
    );
  });
});
