import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Contact } from '@/types/contact';
import { applyMergeChoices, defaultMergeChoices, mergeFieldDisplay } from './merge';

function contact(partial: Partial<Contact> & Pick<Contact, 'id' | 'fullName'>): Contact {
  return {
    agencyId: 'a',
    createdBy: 'u1',
    firstName: 'Marie',
    lastName: 'Dupont',
    type: 'vendeur',
    phone: null,
    email: null,
    secteur: null,
    criteria: {
      budgetMin: null,
      budgetMax: null,
      surfaceMin: null,
      surfaceMax: null,
      roomsMin: null,
      postalCodes: [],
    },
    summary: null,
    lastInteractionAt: null,
    recontacterLe: null,
    doublonDe: null,
    source: 'manuel',
    address: null,
    banId: null,
    latitude: null,
    longitude: null,
    leadId: null,
    assignedTo: 'u1',
    assignedBy: null,
    assignedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...partial,
  };
}

describe('defaultMergeChoices', () => {
  it('prend la fiche absorbée quand la conservée est vide', () => {
    const keep = contact({ id: 'k', fullName: 'Marie', firstName: 'Marie', lastName: '', phone: null });
    const absorb = contact({
      id: 'a',
      fullName: 'Marie Dupont',
      firstName: 'Marie',
      lastName: 'Dupont',
      phone: '0601020304',
    });
    const choices = defaultMergeChoices(keep, absorb);
    assert.equal(choices.lastName, 'absorb');
    assert.equal(choices.phone, 'absorb');
    assert.equal(choices.firstName, 'keep');
  });
});

describe('applyMergeChoices', () => {
  it('reporte le téléphone choisi sur le patch', () => {
    const keep = contact({ id: 'k', fullName: 'A', firstName: 'A', lastName: 'A', phone: '0600000001' });
    const absorb = contact({ id: 'b', fullName: 'B', firstName: 'B', lastName: 'B', phone: '0600000002' });
    const patch = applyMergeChoices(keep, absorb, { phone: 'absorb', firstName: 'keep' });
    assert.equal(patch.phone, '0600000002');
    assert.equal(patch.firstName, 'A');
  });
});

describe('mergeFieldDisplay', () => {
  it('affiche le type en clair', () => {
    const c = contact({ id: 'k', fullName: 'A', type: 'commercant' });
    assert.equal(mergeFieldDisplay(c, 'type'), 'Commerçant');
  });
});
