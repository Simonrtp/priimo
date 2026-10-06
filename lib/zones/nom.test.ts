import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { estNomParDefaut, nomSecteurParDefaut, prenomDuMembre, trierSecteurs } from './nom';

describe('nom d’un secteur', () => {
  it('porte le prénom du négociateur', () => {
    assert.equal(nomSecteurParDefaut('Camille', []), 'Secteur de Camille');
  });

  it('numérote un deuxième secteur du même négociateur', () => {
    assert.equal(nomSecteurParDefaut('Camille', ['secteur de camille']), 'Secteur de Camille 2');
    assert.equal(
      nomSecteurParDefaut('Camille', ['Secteur de Camille', 'Secteur de Camille 2']),
      'Secteur de Camille 3',
    );
  });

  it('reste neutre sans titulaire', () => {
    assert.equal(nomSecteurParDefaut(null, []), 'Nouveau secteur');
    assert.equal(nomSecteurParDefaut(null, ['Nouveau secteur']), 'Nouveau secteur 2');
  });

  it('reconnaît un nom donné d’office, pas un nom choisi', () => {
    assert.equal(estNomParDefaut('Secteur de Camille', 'Camille'), true);
    assert.equal(estNomParDefaut('Secteur de Camille 2', 'Camille'), true);
    assert.equal(estNomParDefaut('Nouveau secteur', null), true);
    assert.equal(estNomParDefaut('Charonne', 'Camille'), false);
    assert.equal(estNomParDefaut('Secteur de Camille Est', 'Camille'), false);
  });

  it('prend le prénom, sinon le premier mot du nom complet', () => {
    assert.equal(prenomDuMembre({ firstName: 'Léa', fullName: 'Léa Martin' }), 'Léa');
    assert.equal(prenomDuMembre({ fullName: 'Hugo Bernard' }), 'Hugo');
    assert.equal(prenomDuMembre({ fullName: '  ' }), null);
    assert.equal(prenomDuMembre(null), null);
  });

  it('range mes secteurs d’abord, puis par nom', () => {
    const tries = trierSecteurs(
      [
        { nom: 'Secteur de Zoé', assignedTo: 'z' },
        { nom: 'Secteur de Camille 10', assignedTo: 'moi' },
        { nom: 'Secteur de Bruno', assignedTo: 'b' },
        { nom: 'Secteur de Camille 2', assignedTo: 'moi' },
      ],
      'moi',
    ).map((z) => z.nom);
    assert.deepEqual(tries, [
      'Secteur de Camille 2',
      'Secteur de Camille 10',
      'Secteur de Bruno',
      'Secteur de Zoé',
    ]);
  });
});
