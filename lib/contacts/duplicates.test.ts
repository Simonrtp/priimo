import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  compareDuplicates,
  findDuplicates,
  isIncompleteContact,
  isRelanceDue,
  levenshtein,
  pairDuplicates,
  type DuplicateFields,
} from './duplicates';

function c(partial: Partial<DuplicateFields> & { id: string; fullName: string }): DuplicateFields {
  const bits = partial.fullName.split(' ');
  return {
    firstName: bits[0] ?? '',
    lastName: bits.slice(1).join(' '),
    phone: null,
    email: null,
    ...partial,
  };
}

describe('levenshtein', () => {
  it('mesure les fautes de frappe', () => {
    assert.equal(levenshtein('dupont', 'dupond'), 1);
    assert.equal(levenshtein('marie', 'marie'), 0);
  });
});

describe('compareDuplicates', () => {
  it('téléphone identique = correspondance forte', () => {
    const hit = compareDuplicates(
      c({ id: '1', fullName: 'Marie Martin', phone: '06 12 34 56 78' }),
      c({ id: '2', fullName: 'Autre', phone: '+33 6 12 34 56 78' }),
    );
    assert.equal(hit?.strength, 'strong');
    assert.equal(hit?.reason, 'telephone');
  });

  it('même nom normalisé = forte', () => {
    const hit = compareDuplicates(
      c({ id: '1', fullName: 'Marie Dupont', firstName: 'Marie', lastName: 'Dupont' }),
      c({ id: '2', fullName: 'marie dupont', firstName: 'Marie', lastName: 'Dupont' }),
    );
    assert.equal(hit?.strength, 'strong');
  });

  it('prénom seul vs prénom+nom = faible', () => {
    const hit = compareDuplicates(
      c({ id: '1', fullName: 'Marie', firstName: 'Marie', lastName: '' }),
      c({ id: '2', fullName: 'Marie Dupont', firstName: 'Marie', lastName: 'Dupont' }),
    );
    assert.equal(hit?.strength, 'weak');
    assert.equal(hit?.reason, 'prenom');
  });
});

describe('pairDuplicates', () => {
  it('ne compte chaque fiche qu’une fois', () => {
    const pairs = pairDuplicates([
      c({ id: '1', fullName: 'Jean Dupont', firstName: 'Jean', lastName: 'Dupont', phone: '0600000001' }),
      c({ id: '2', fullName: 'J Dupont', firstName: 'J', lastName: 'Dupont', phone: '0600000001' }),
      c({ id: '3', fullName: 'Autre', firstName: 'Autre', lastName: 'X' }),
    ]);
    assert.equal(pairs.length, 1);
    assert.equal(pairs[0]?.strength, 'strong');
  });

  it('ignore un numéro partagé par une foule', () => {
    const pairs = pairDuplicates([
      c({ id: '1', fullName: 'Alain Arnaud', firstName: 'Alain', lastName: 'Arnaud', phone: '0639980505' }),
      c({ id: '2', fullName: 'David Bonnet', firstName: 'David', lastName: 'Bonnet', phone: '0639980505' }),
      c({ id: '3', fullName: 'Amélie Hubert', firstName: 'Amélie', lastName: 'Hubert', phone: '0639980505' }),
    ]);
    assert.equal(pairs.length, 0);
  });
});

describe('findDuplicates', () => {
  it('classe le fort avant le faible', () => {
    const hits = findDuplicates(c({ id: 'n', fullName: 'Marie Dupont', firstName: 'Marie', lastName: 'Dupont', phone: '0611111111' }), [
      c({ id: 'w', fullName: 'Marie', firstName: 'Marie', lastName: '' }),
      c({ id: 's', fullName: 'X', firstName: 'X', lastName: 'Y', phone: '0611111111' }),
    ]);
    assert.equal(hits[0]?.other.id, 's');
    assert.equal(hits[0]?.strength, 'strong');
  });
});

describe('helpers', () => {
  it('repère une fiche sans moyen de contact', () => {
    assert.equal(isIncompleteContact({ phone: null, email: null }), true);
    assert.equal(isIncompleteContact({ phone: '06', email: null }), false);
  });

  it('une relance est due le jour J', () => {
    assert.equal(isRelanceDue('2026-08-26', '2026-08-26'), true);
    assert.equal(isRelanceDue('2026-08-27', '2026-08-26'), false);
    assert.equal(isRelanceDue(null, '2026-08-26'), false);
  });
});
