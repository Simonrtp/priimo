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

describe('fiche contact privée ou partagée', () => {
  const privee = { assignedTo: 'moi', createdBy: 'moi', visibilite: 'privee' as const };
  const partagee = { assignedTo: 'moi', createdBy: 'moi', visibilite: 'agence' as const };

  it('garde une fiche privée pour son titulaire et la direction', () => {
    assert.equal(canSeeContact(MOI, privee), true);
    assert.equal(canSeeContact(DIR, privee), true);
    assert.equal(canSeeContact(AUTRE, privee), false);
  });

  it('traite une fiche sans réglage (colonne pas encore migrée) comme privée', () => {
    assert.equal(canSeeContact(AUTRE, { assignedTo: 'moi', createdBy: 'moi' }), false);
  });

  it('montre une fiche partagée à toute l’agence', () => {
    assert.equal(canSeeContact(AUTRE, partagee), true);
  });

  it('laisse au titulaire et à la direction seuls le droit d’en disposer', () => {
    assert.equal(canManageContact(MOI, partagee), true);
    assert.equal(canManageContact(DIR, partagee), true);
    assert.equal(canManageContact(AUTRE, partagee), false);
  });
});
