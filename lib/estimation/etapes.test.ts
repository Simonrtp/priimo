import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { EstimationObjet } from './objet';
import { BIEN_VIDE } from './objet';
import { etapeValidee } from './etapes';

function fiche(partial: Partial<EstimationObjet>): EstimationObjet {
  return {
    bien: { ...BIEN_VIDE },
    grille: {},
    contactId: null,
    address: null,
    propertyType: null,
    surfaceM2: null,
    rooms: null,
    priceValue: null,
    etat: 'brouillon',
    ...partial,
  } as EstimationObjet;
}

describe('etapeValidee', () => {
  it('coche le client dès qu’une fiche est rattachée', () => {
    assert.equal(etapeValidee(fiche({}), 'client'), false);
    assert.equal(etapeValidee(fiche({ contactId: 'c1' }), 'client'), true);
  });

  it('coche le bien seulement si adresse, type, surface et pièces sont là', () => {
    const incomplet = fiche({ address: '12 rue X', propertyType: 'appartement' });
    assert.equal(etapeValidee(incomplet, 'bien'), false);
    assert.equal(
      etapeValidee(fiche({ address: '12 rue X', propertyType: 'appartement', surfaceM2: 60, rooms: 3 }), 'bien'),
      true,
    );
  });

  it('coche les caractéristiques si la grille a une note, ou si on est passé après', () => {
    assert.equal(etapeValidee(fiche({}), 'caracteristiques', 0), false);
    assert.equal(
      etapeValidee(fiche({ grille: { standing: { valeur: 4, source: 'agent' } } }), 'caracteristiques'),
      true,
    );
    assert.equal(etapeValidee(fiche({}), 'caracteristiques', 3), true);
  });
});
