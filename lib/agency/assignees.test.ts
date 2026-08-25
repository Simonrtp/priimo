import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseAssigneeId } from './assignees';
import { suggestMemberFromText } from './match-member';
import {
  AGENCY_RECORD_VISIBILITY,
  canSeeLeadRecord,
  canSeeOwnedRecord,
} from './visibility';

const marie = { id: 'm1', firstName: 'Marie', lastName: 'Curie', fullName: 'Marie Curie' };
const paul = { id: 'p1', firstName: 'Paul', lastName: 'Martin', fullName: 'Paul Martin' };
const members = [marie, paul];

describe('parseAssigneeId', () => {
  const ids = new Set(['m1', 'p1']);

  it('refuse un nom libre', () => {
    const parsed = parseAssigneeId('Marie Curie', ids);
    assert.equal('invalid' in parsed && parsed.invalid, true);
  });

  it('accepte uniquement un id de membre', () => {
    const parsed = parseAssigneeId('m1', ids);
    assert.equal(parsed.provided, true);
    assert.ok(!('invalid' in parsed));
    if (!parsed.provided || 'invalid' in parsed) return;
    assert.equal(parsed.id, 'm1');
  });

  it('traite une chaîne vide comme non assigné', () => {
    const parsed = parseAssigneeId('', ids);
    assert.equal(parsed.provided, true);
    assert.ok(!('invalid' in parsed));
    if (!parsed.provided || 'invalid' in parsed) return;
    assert.equal(parsed.id, null);
  });
});

describe('suggestMemberFromText', () => {
  it('propose Marie quand le nom de famille est dit', () => {
    const hit = suggestMemberFromText('Passe le dossier à Curie demain', members, 'me');
    assert.equal(hit?.id, 'm1');
  });

  it('ne propose rien si le nom n’est dans l’équipe', () => {
    assert.equal(suggestMemberFromText('À transmettre à Dupont', members, 'me'), null);
  });

  it('ne propose rien si deux membres pourraient matcher', () => {
    const twoMaries = [
      marie,
      { id: 'm2', firstName: 'Marie', lastName: 'Langevin', fullName: 'Marie Langevin' },
    ];
    assert.equal(suggestMemberFromText('Dis-le à Marie', twoMaries, 'me'), null);
  });

  it('ne s’assigne pas tout seul', () => {
    assert.equal(
      suggestMemberFromText('Marie Curie a appelé', members, 'm1'),
      null,
    );
  });
});

describe('visibilité interne', () => {
  it('reste stricte par défaut', () => {
    assert.equal(AGENCY_RECORD_VISIBILITY, 'own');
  });

  it('cache le contact d’un collègue à un collaborateur', () => {
    const collab = { id: 'p1', role: 'collaborateur' as const };
    assert.equal(
      canSeeOwnedRecord(collab, { assignedTo: 'm1', createdBy: 'm1' }),
      false,
    );
    assert.equal(
      canSeeOwnedRecord(collab, { assignedTo: 'p1', createdBy: 'm1' }),
      true,
    );
    assert.equal(
      canSeeOwnedRecord({ id: 'dir', role: 'directeur' }, { assignedTo: 'm1', createdBy: 'm1' }),
      true,
    );
  });

  it('laisse la file de leads non assignés visible', () => {
    const collab = { id: 'p1', role: 'collaborateur' as const };
    assert.equal(canSeeLeadRecord(collab, { assignedTo: null }), true);
    assert.equal(canSeeLeadRecord(collab, { assignedTo: 'm1' }), false);
    assert.equal(canSeeLeadRecord(collab, { assignedTo: 'p1' }), true);
  });
});
