import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  canAccessAgency,
  resolveActiveAgencyId,
  resolveActiveRole,
} from './active-agency';

describe('resolveActiveAgencyId', () => {
  const memberships = [
    { agency_id: 'agency-a', role: 'directeur' as const },
    { agency_id: 'agency-b', role: 'directeur' as const },
  ];

  it('utilise active_agency_id si membre', () => {
    const id = resolveActiveAgencyId({ active_agency_id: 'agency-b' }, memberships);
    assert.equal(id, 'agency-b');
  });

  it('retombe sur la première agence si active_agency_id invalide', () => {
    const id = resolveActiveAgencyId({ active_agency_id: 'agency-x' }, memberships);
    assert.equal(id, 'agency-a');
  });

  it('mono-agence : première (et seule) agence', () => {
    const id = resolveActiveAgencyId(
      { active_agency_id: null },
      [{ agency_id: 'agency-a' }],
    );
    assert.equal(id, 'agency-a');
  });

  it('sans membership : null', () => {
    assert.equal(resolveActiveAgencyId({ active_agency_id: null }, []), null);
  });
});

describe('resolveActiveRole', () => {
  it('retourne le rôle dans l agence active', () => {
    const role = resolveActiveRole(
      [
        { agency_id: 'agency-a', role: 'directeur' },
        { agency_id: 'agency-b', role: 'collaborateur' },
      ],
      'agency-b',
    );
    assert.equal(role, 'collaborateur');
  });
});

describe('canAccessAgency — isolation inter-agences', () => {
  const agencyAMemberships = [{ agency_id: 'agency-a', role: 'collaborateur' as const }];

  it('autorise l agence A pour un membre de A', () => {
    assert.equal(canAccessAgency(agencyAMemberships, 'agency-a'), true);
  });

  it('refuse l agence B pour un membre de A (fuite inter-agences)', () => {
    assert.equal(canAccessAgency(agencyAMemberships, 'agency-b'), false);
  });
});
