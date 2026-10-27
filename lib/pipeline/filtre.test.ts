import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { estBienRentre, leadPipelineCorrespond, libelleRentree } from './filtre.js';
import type { Lead } from '@/types/lead';

function lead(partial: Partial<Lead> = {}): Lead {
  return {
    address: '10 rue des Maraîchers',
    city: 'Paris',
    postalCode: '75020',
    ownerName: 'Dupont',
    propertyType: 'appartement',
    surfaceM2: 40,
    rooms: 2,
    notes: null,
    bien: null,
    takenAt: '2026-10-20T10:00:00.000Z',
    ...partial,
  } as Lead;
}

describe('filtre pipeline', () => {
  it('retrouve une carte par adresse ou propriétaire', () => {
    const l = lead();
    assert.equal(leadPipelineCorrespond(l, 'maraichers'), true);
    assert.equal(leadPipelineCorrespond(l, 'dupont'), true);
    assert.equal(leadPipelineCorrespond(l, 'lyon'), false);
  });

  it('reconnaît un bien rentré', () => {
    assert.equal(estBienRentre(lead()), false);
    assert.equal(
      estBienRentre(
        lead({
          bien: { id: 'b1', propertyType: 'Appartement', surfaceM2: 40, rooms: 2, price: 300000, photo: null },
        }),
      ),
      true,
    );
  });

  it('formule la date d’entrée', () => {
    const maintenant = new Date('2026-10-27T12:00:00.000Z');
    assert.equal(libelleRentree('2026-10-27T08:00:00.000Z', maintenant), 'Rentré aujourd’hui');
    assert.equal(libelleRentree('2026-10-26T08:00:00.000Z', maintenant), 'Rentré hier');
    assert.equal(libelleRentree('2026-10-24T08:00:00.000Z', maintenant), 'Rentré il y a 3 j');
    assert.match(libelleRentree('2026-10-01T08:00:00.000Z', maintenant) ?? '', /Rentré le/);
    assert.equal(libelleRentree(null, maintenant), null);
  });
});
