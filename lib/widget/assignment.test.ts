import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { chooseAssignee, type AssignableMember } from './assignment';

const directeur: AssignableMember = { id: 'dir', fullName: 'Zoé Directrice', role: 'directeur' };
const alice: AssignableMember = { id: 'a', fullName: 'Alice Martin', role: 'collaborateur' };
const bruno: AssignableMember = { id: 'b', fullName: 'Bruno Costa', role: 'collaborateur' };

describe('assignation des demandes du site agence', () => {
  it('choisit le collaborateur le moins chargé', () => {
    const charge = new Map([
      ['a', 4],
      ['b', 1],
    ]);
    assert.equal(chooseAssignee([directeur, alice, bruno], charge), 'b');
  });

  it('départage à égalité par ordre alphabétique', () => {
    const charge = new Map([
      ['a', 2],
      ['b', 2],
    ]);
    assert.equal(chooseAssignee([alice, bruno], charge), 'a');
  });

  it('retombe sur le directeur quand il est seul', () => {
    assert.equal(chooseAssignee([directeur], new Map()), 'dir');
  });

  it('ne renvoie rien si l’agence n’a aucun membre', () => {
    assert.equal(chooseAssignee([], new Map()), null);
  });
});
