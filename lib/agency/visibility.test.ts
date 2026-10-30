import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  canCreateZone,
  canEditZone,
  canManageContact,
  canManageZone,
  canSeeActivityOf,
  canSeeContact,
} from './visibility';

const DIR = { id: 'dir', role: 'directeur' as const };
const MOI = { id: 'moi', role: 'collaborateur' as const };
const AUTRE = { id: 'autre', role: 'collaborateur' as const };

describe('droits sur une zone', () => {
  it('laisse le négociateur créer la sienne, pas celle d’un collègue', () => {
    assert.equal(canCreateZone(MOI, 'moi'), true);
    assert.equal(canCreateZone(MOI, 'autre'), false);
    assert.equal(canCreateZone(DIR, 'autre'), true);
  });

  it('laisse le titulaire retoucher tant que ce n’est pas verrouillé', () => {
    assert.equal(canEditZone(MOI, { assignedTo: 'moi', verrouillee: false }), true);
    assert.equal(canEditZone(MOI, { assignedTo: 'moi', verrouillee: true }), false);
    assert.equal(canEditZone(AUTRE, { assignedTo: 'moi', verrouillee: false }), false);
    assert.equal(canEditZone(DIR, { assignedTo: 'moi', verrouillee: true }), true);
  });

  it('réserve le verrou et la réattribution au directeur', () => {
    assert.equal(canManageZone(DIR), true);
    assert.equal(canManageZone(MOI), false);
  });
});

describe('activité d’un collaborateur', () => {
  it('reste personnelle pour un négociateur', () => {
    assert.equal(canSeeActivityOf(MOI, 'moi'), true);
    assert.equal(canSeeActivityOf(MOI, 'autre'), false);
    assert.equal(canSeeActivityOf(DIR, 'autre'), true);
  });
});

describe('fiche contact : au titulaire et à la direction', () => {
  const fiche = { assignedTo: 'moi', createdBy: 'moi' };

  it('garde la fiche pour son titulaire et la direction', () => {
    assert.equal(canSeeContact(MOI, fiche), true);
    assert.equal(canSeeContact(DIR, fiche), true);
    assert.equal(canSeeContact(AUTRE, fiche), false);
  });

  it('suit l’assigné quand il diffère de l’auteur', () => {
    const transmise = { assignedTo: 'autre', createdBy: 'moi' };
    assert.equal(canSeeContact(AUTRE, transmise), true);
    assert.equal(canSeeContact(MOI, transmise), false);
  });

  it('ne s’ouvre à personne, même si la colonne de partage dit « agence »', () => {
    assert.equal(canSeeContact(AUTRE, { ...fiche, visibilite: 'agence' }), false);
  });

  it('laisse au titulaire et à la direction seuls le droit d’en disposer', () => {
    assert.equal(canManageContact(MOI, fiche), true);
    assert.equal(canManageContact(DIR, fiche), true);
    assert.equal(canManageContact(AUTRE, fiche), false);
  });
});
