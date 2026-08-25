import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Lead } from '@/types/lead';
import {
  MAX_SORTIE_STOPS,
  buildSortie,
  isLeadForSortie,
  orderNearestNeighbor,
  sortieSignature,
  sortieStorageKey,
} from './sortie';

function lead(
  id: string,
  lat: number,
  lng: number,
  extra: Partial<Lead> = {},
): Lead {
  return {
    id,
    agencyId: 'a',
    address: id,
    city: 'Paris',
    postalCode: '75020',
    propertyType: 'Appartement',
    surfaceM2: 50,
    ownerType: 'particulier',
    companyName: null,
    companyDirector: null,
    companyPhone: null,
    companyEmail: null,
    score: 70,
    signals: [],
    mainSignalLabel: null,
    displaySignals: {},
    banId: `ban-${id}`,
    latitude: lat,
    longitude: lng,
    acquiredYear: null,
    acquiredPrice: null,
    acquiredPriceReliable: null,
    estimatedValue: null,
    estimationLow: null,
    estimationHigh: null,
    estimationConfidence: null,
    estimationBasis: null,
    plusValuePct: null,
    rooms: 3,
    floor: null,
    etage: '2',
    dpeClass: null,
    dpeDate: null,
    status: 'nouveau',
    notes: null,
    assignedTo: null,
    mlFeedback: null,
    mlFeedbackReason: null,
    mlFeedbackAt: null,
    marcheStatut: null,
    marcheVerifieLe: null,
    ownerName: null,
    ownerAge: null,
    ownerCompany: null,
    ownerSiren: null,
    ownerPhone: null,
    ownerPhoneSource: null,
    contactabilite: null,
    contactsImmeuble: [],
    scriptApproche: null,
    deliveredAt: '2026-08-20',
    createdAt: '2026-08-20T08:00:00Z',
    updatedAt: '2026-08-20T08:00:00Z',
    ...extra,
  };
}

describe('isLeadForSortie', () => {
  it('exclut les mandats signés et les leads assignés à un autre', () => {
    assert.equal(isLeadForSortie(lead('a', 48.86, 2.34, { status: 'mandat_signe' }), 'p1'), false);
    assert.equal(isLeadForSortie(lead('a', 48.86, 2.34, { assignedTo: 'other' }), 'p1'), false);
    assert.equal(isLeadForSortie(lead('a', 48.86, 2.34), 'p1'), true);
  });
});

describe('buildSortie', () => {
  const origin = { latitude: 48.86, longitude: 2.34 };

  it('retourne null sans lead géolocalisé', () => {
    assert.equal(buildSortie([lead('a', 48.86, 2.34, { latitude: null })], 'p1', origin), null);
  });

  it('plafonne à 10 adresses', () => {
    const leads = Array.from({ length: 15 }, (_, i) =>
      lead(`l${i}`, 48.86 + i * 0.0002, 2.34 + i * 0.0001),
    );
    const plan = buildSortie(leads, 'p1', origin, 800);
    assert.ok(plan);
    assert.ok(plan!.ordered.length <= MAX_SORTIE_STOPS);
  });

  it('ordonne au plus proche voisin depuis le GPS', () => {
    const leads = [
      lead('loin', 48.866, 2.34),
      lead('pres', 48.861, 2.34),
    ];
    const plan = buildSortie(leads, 'p1', origin, 800);
    assert.ok(plan);
    assert.equal(plan!.ordered[0]!.key, 'pres');
    assert.equal(plan!.ordered[1]!.key, 'loin');
  });

  it('produit une signature stable', () => {
    const plan = buildSortie([lead('a', 48.86, 2.34), lead('b', 48.862, 2.341)], 'p1', origin);
    assert.equal(plan!.signature, sortieSignature(plan!.ordered));
  });
});

describe('sortieStorageKey', () => {
  it('isole la progression par agent et par jour', () => {
    assert.equal(sortieStorageKey('p1', '2026-08-23'), 'priimo-sortie:p1:2026-08-23');
    assert.notEqual(sortieStorageKey('p1', '2026-08-23'), sortieStorageKey('p2', '2026-08-23'));
  });
});

describe('orderNearestNeighbor', () => {
  it('part du GPS quand fourni', () => {
    const origin = { latitude: 48.86, longitude: 2.34 };
    const ordered = orderNearestNeighbor(
      [
        { key: 'loin', address: 'loin', latitude: 48.866, longitude: 2.34 },
        { key: 'pres', address: 'pres', latitude: 48.861, longitude: 2.34 },
      ],
      origin,
    );
    assert.equal(ordered[0]?.key, 'pres');
  });
});
