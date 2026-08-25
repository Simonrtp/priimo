import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { canAccessAgency } from '../auth/active-agency';
import {
  AGENCY_RECORD_VISIBILITY,
  collaboratorSeesColleaguesRecords,
} from '../agency/visibility';
import {
  AgencyScopeError,
  assertAgencyScope,
  sortAgencyMembers,
  tallyByOwner,
  type AgencyMember,
} from './agency-members';

function member(partial: Partial<AgencyMember> & Pick<AgencyMember, 'id' | 'fullName' | 'role'>): AgencyMember {
  return {
    firstName: '',
    lastName: '',
    email: '',
    contactCount: 0,
    leadCount: 0,
    ...partial,
  };
}

describe('assertAgencyScope', () => {
  it('autorise un membre de son agence', () => {
    assert.doesNotThrow(() =>
      assertAgencyScope([{ agency_id: 'agence-a' }], 'agence-a'),
    );
  });

  it('refuse une autre agence — isolation inter-agences', () => {
    assert.throws(
      () => assertAgencyScope([{ agency_id: 'agence-a' }], 'agence-b'),
      AgencyScopeError,
    );
    assert.equal(canAccessAgency([{ agency_id: 'agence-a' }], 'agence-b'), false);
  });

  it('refuse un identifiant vide', () => {
    assert.throws(() => assertAgencyScope([{ agency_id: 'agence-a' }], ''), AgencyScopeError);
  });
});

describe('sortAgencyMembers', () => {
  it('place le directeur en tête, puis le nom', () => {
    const sorted = sortAgencyMembers([
      member({ id: '2', fullName: 'Zoé Martin', role: 'collaborateur' }),
      member({ id: '1', fullName: 'Anne Durand', role: 'collaborateur' }),
      member({ id: '3', fullName: 'Paul Directeur', role: 'directeur' }),
    ]);
    assert.deepEqual(
      sorted.map((m) => m.id),
      ['3', '1', '2'],
    );
  });
});

describe('tallyByOwner', () => {
  it('ignore les lignes sans propriétaire et compte par personne', () => {
    const counts = tallyByOwner([
      { ownerId: 'marie' },
      { ownerId: 'marie' },
      { ownerId: null },
      { ownerId: 'paul' },
    ]);
    assert.equal(counts.get('marie'), 2);
    assert.equal(counts.get('paul'), 1);
    assert.equal(counts.has('inconnu'), false);
  });
});

describe('visibilité interne à l agence', () => {
  it('est stricte par défaut : un collaborateur ne voit pas les fiches des collègues', () => {
    assert.equal(AGENCY_RECORD_VISIBILITY, 'own');
    assert.equal(collaboratorSeesColleaguesRecords(), false);
  });
});
