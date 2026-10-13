import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { tachesMiseEnPlace } from './mise-en-place';

describe('tachesMiseEnPlace', () => {
  it('ne propose rien une fois l’agenda et le secteur en place', () => {
    assert.deepEqual(tachesMiseEnPlace({ agendaConnecte: true, aUnSecteur: true }), []);
  });

  it('demande l’agenda s’il n’est pas branché', () => {
    assert.deepEqual(tachesMiseEnPlace({ agendaConnecte: false, aUnSecteur: true }), ['agenda']);
  });

  it('demande le secteur s’il n’est pas dessiné', () => {
    assert.deepEqual(tachesMiseEnPlace({ agendaConnecte: true, aUnSecteur: false }), ['secteur']);
  });

  it('demande les deux s’il manque tout', () => {
    assert.deepEqual(tachesMiseEnPlace({ agendaConnecte: false, aUnSecteur: false }), [
      'agenda',
      'secteur',
    ]);
  });
});
