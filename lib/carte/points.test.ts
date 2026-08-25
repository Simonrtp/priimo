import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isUsableCoord } from './coords';
import {
  buildSectorMapPoints,
  postalCodesFromPoints,
  type MappableBien,
  type MappableContact,
  type MappableLead,
  type MappableNote,
} from './points';

function lead(partial: Partial<MappableLead> & Pick<MappableLead, 'id'>): MappableLead {
  return {
    agencyId: 'agence-a',
    address: `${partial.id} rue Test`,
    city: 'Lille',
    postalCode: '59000',
    score: 80,
    mainSignalLabel: 'DPE récent',
    propertyType: 'Appartement',
    surfaceM2: 70,
    banId: '59122_lead',
    latitude: 50.63,
    longitude: 3.06,
    assignedTo: 'marie',
    createdAt: '2026-08-01T00:00:00.000Z',
    deliveredAt: '2026-08-01',
    ...partial,
  };
}

function contact(
  partial: Partial<MappableContact> & Pick<MappableContact, 'id'>,
): MappableContact {
  return {
    agencyId: 'agence-a',
    fullName: 'Marie Curie',
    type: 'vendeur',
    phone: '0601020304',
    secteur: 'Vieux Lille',
    address: '12 rue Test',
    banId: null,
    leadId: null,
    latitude: null,
    longitude: null,
    assignedTo: 'marie',
    lastInteractionAt: '2026-08-10T00:00:00.000Z',
    createdAt: '2026-08-01T00:00:00.000Z',
    source: 'manuel',
    ...partial,
  };
}

function bien(partial: Partial<MappableBien> & Pick<MappableBien, 'id'>): MappableBien {
  return {
    agencyId: 'agence-a',
    address: '12 rue de la Monnaie',
    city: 'Lille',
    postalCode: '59000',
    price: 300000,
    mandatStatut: 'mandat_simple',
    leadId: null,
    propertyType: 'Appartement',
    surfaceM2: 80,
    banId: null,
    latitude: null,
    longitude: null,
    createdBy: 'marie',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...partial,
  };
}

function note(partial: Partial<MappableNote> & Pick<MappableNote, 'id'>): MappableNote {
  return {
    agencyId: 'agence-a',
    contactId: null,
    transcript: 'Vu le gardien',
    adresseNormalisee: null,
    banId: null,
    latitude: null,
    longitude: null,
    assignedTo: null,
    createdBy: 'marie',
    createdAt: '2026-08-12T00:00:00.000Z',
    ...partial,
  };
}

describe('isUsableCoord', () => {
  it('refuse l’origine et les valeurs vides', () => {
    assert.equal(isUsableCoord(0, 0), false);
    assert.equal(isUsableCoord(null, 3), false);
    assert.equal(isUsableCoord(50.6, 3.06), true);
  });
});

describe('buildSectorMapPoints', () => {
  it('ignore un lead d’une autre agence — isolation inter-agences', () => {
    const { points } = buildSectorMapPoints({
      agencyId: 'agence-a',
      leads: [lead({ id: 'fuite', agencyId: 'agence-b' })],
      contacts: [],
      biens: [],
    });
    assert.equal(points.length, 0);
  });

  it('place un lead déjà géolocalisé avec ban_id', () => {
    const { points, withoutPosition } = buildSectorMapPoints({
      agencyId: 'agence-a',
      leads: [lead({ id: 'l1' })],
      contacts: [],
      biens: [],
    });
    assert.equal(points.length, 1);
    assert.equal(points[0]?.kind, 'lead');
    assert.equal(points[0]?.href, '/dashboard/prospection?lead=l1');
    assert.equal(withoutPosition.leads, 0);
  });

  it('laisse hors carte un lead sans ban_id', () => {
    const { points, withoutPosition } = buildSectorMapPoints({
      agencyId: 'agence-a',
      leads: [lead({ id: 'l2', banId: null, latitude: 50.63, longitude: 3.06 })],
      contacts: [],
      biens: [],
    });
    assert.equal(points.length, 0);
    assert.equal(withoutPosition.leads, 1);
  });

  it('place un contact géocodé même sans lead rattaché', () => {
    const { points, withoutPosition } = buildSectorMapPoints({
      agencyId: 'agence-a',
      leads: [],
      contacts: [
        contact({
          id: 'c1',
          banId: '59122_c',
          latitude: 50.63,
          longitude: 3.06,
          postalCodes: ['59000'],
        }),
      ],
      biens: [],
    });
    assert.equal(points.length, 1);
    assert.equal(points[0]?.kind, 'contact');
    assert.equal(withoutPosition.contacts, 0);
  });

  it('place un bien géocodé même sans lead rattaché', () => {
    const { points } = buildSectorMapPoints({
      agencyId: 'agence-a',
      leads: [],
      contacts: [],
      biens: [bien({ id: 'b1', banId: '59122_b', latitude: 50.63, longitude: 3.06 })],
    });
    assert.equal(points.filter((p) => p.kind === 'bien').length, 1);
  });

  it('place une note terrain géolocalisée sans contact rattaché', () => {
    const { points, withoutPosition } = buildSectorMapPoints({
      agencyId: 'agence-a',
      leads: [],
      contacts: [],
      biens: [],
      notes: [
        note({
          id: 'n1',
          banId: '59122_n',
          latitude: 50.63,
          longitude: 3.06,
        }),
      ],
    });
    assert.equal(points.length, 1);
    assert.equal(points[0]?.kind, 'note');
    assert.equal(withoutPosition.notes, 0);
  });

  it('place un bien géolocalisé même sans ban_id', () => {
    const { points } = buildSectorMapPoints({
      agencyId: 'agence-a',
      leads: [],
      contacts: [],
      biens: [bien({ id: 'b-gps', banId: null, latitude: 50.63, longitude: 3.06 })],
    });
    assert.equal(points.filter((p) => p.kind === 'bien').length, 1);
    assert.equal(points[0]?.banId, 'bien:b-gps');
  });

  it('place une note rattachée à un contact si elle est géolocalisée', () => {
    const { points } = buildSectorMapPoints({
      agencyId: 'agence-a',
      leads: [],
      contacts: [],
      biens: [],
      notes: [
        note({
          id: 'n2',
          contactId: 'c1',
          banId: '59122_n',
          latitude: 50.63,
          longitude: 3.06,
        }),
      ],
    });
    assert.equal(points.length, 1);
    assert.equal(points[0]?.kind, 'note');
  });

  it('n’affiche pas un contact créé par dictée sur la couche Contacts', () => {
    const { points } = buildSectorMapPoints({
      agencyId: 'agence-a',
      leads: [],
      contacts: [
        contact({
          id: 'c-vocal',
          source: 'vocal',
          banId: '59122_c',
          latitude: 50.63,
          longitude: 3.06,
        }),
      ],
      biens: [],
    });
    assert.equal(points.length, 0);
  });

  it('place une note GPS même sans ban_id', () => {
    const { points } = buildSectorMapPoints({
      agencyId: 'agence-a',
      leads: [],
      contacts: [],
      biens: [],
      notes: [
        note({
          id: 'n-gps',
          banId: null,
          latitude: 50.63,
          longitude: 3.06,
        }),
      ],
    });
    assert.equal(points.length, 1);
    assert.equal(points[0]?.banId, 'gps:n-gps');
  });

  it('ne place plus un contact par héritage du lead : il faut son ban_id', () => {
    const orphan = buildSectorMapPoints({
      agencyId: 'agence-a',
      leads: [lead({ id: 'l1' })],
      contacts: [contact({ id: 'c2', leadId: 'l1' })],
      biens: [],
    });
    assert.equal(orphan.points.filter((p) => p.kind === 'contact').length, 0);
    assert.equal(orphan.withoutPosition.contacts, 1);
  });
});

describe('postalCodesFromPoints', () => {
  it('unionne le secteur de l’agence et les codes présents', () => {
    const codes = postalCodesFromPoints(
      ['59000', 'abc'],
      [{ postalCode: '59100' } as never],
    );
    assert.deepEqual(codes, ['59000', '59100']);
  });
});
