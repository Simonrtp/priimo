import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  resolveActiveAgencyId,
  resolveActiveRole,
} from './active-agency';

describe('resolveActiveAgencyId', () => {
  const memberships = [
    { agency_id: 'agency-a', role: 'directeur' as const },
    { agency_id: 'agency-b', role: 'directeur' as const },
  ];

  it('utilise active_agency_id si membre', () => {
    const id = resolveActiveAgencyId(
      { agency_id: 'agency-a', active_agency_id: 'agency-b' },
      memberships,
    );
    assert.equal(id, 'agency-b');
  });

  it('retombe sur agency_id si active_agency_id invalide', () => {
    const id = resolveActiveAgencyId(
      { agency_id: 'agency-a', active_agency_id: 'agency-x' },
      memberships,
    );
    assert.equal(id, 'agency-a');
  });

  it('mono-agence : agency_id par défaut', () => {
    const id = resolveActiveAgencyId(
      { agency_id: 'agency-a', active_agency_id: null },
      [{ agency_id: 'agency-a', role: 'collaborateur' }],
    );
    assert.equal(id, 'agency-a');
  });
});

describe('resolveActiveRole', () => {
  it('retourne le rôle dans l agence active', () => {
    const role = resolveActiveRole(
      { agency_id: 'agency-a', role: 'directeur' },
      [
        { agency_id: 'agency-a', role: 'directeur' },
        { agency_id: 'agency-b', role: 'collaborateur' },
      ],
      'agency-b',
    );
    assert.equal(role, 'collaborateur');
  });
});
