import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { EMPTY_DISPLAY_SIGNALS } from './display-signals';
import { buildLeadRecap, recapHeadline } from './lead-recap';
import type { Lead } from '../types/lead';

function lead(overrides: Partial<Lead> = {}): Pick<
  Lead,
  | 'ownerName'
  | 'ownerCompany'
  | 'companyName'
  | 'companyDirector'
  | 'ownerType'
  | 'propertyType'
  | 'surfaceM2'
  | 'rooms'
  | 'etage'
  | 'dpeClass'
  | 'dpeDate'
  | 'mainSignalLabel'
  | 'displaySignals'
  | 'notes'
> {
  return {
    ownerName: 'DUPONT JEAN',
    ownerCompany: null,
    companyName: null,
    companyDirector: null,
    ownerType: 'particulier',
    propertyType: 'Appartement',
    surfaceM2: 68,
    rooms: 3,
    etage: '4',
    dpeClass: 'D',
    dpeDate: '2026-08-01',
    mainSignalLabel: null,
    displaySignals: {
      ...EMPTY_DISPLAY_SIGNALS,
      cascade: { nbVentes: 3, dates: ['04/2026'], tooltip: null },
    },
    notes: '[21 août 2026] Fait par : Marie à 10:12\nRappeler en septembre.',
    ...overrides,
  };
}

describe('buildLeadRecap', () => {
  it('formule le propriétaire et le bien', () => {
    const recap = buildLeadRecap(lead());
    assert.equal(recap.who, 'Dupont Jean');
    assert.equal(recap.bien, 'un T3 de 68 m² au 4e');
    assert.equal(recapHeadline(recap), 'Dupont Jean a un T3 de 68 m² au 4e.');
  });

  it('retient le diagnostic récent et les ventes', () => {
    const recap = buildLeadRecap(lead());
    assert.ok(recap.faits.some((f) => /diagnostic récent/.test(f)));
    assert.ok(recap.faits.some((f) => /3 ventes/.test(f)));
  });

  it('extrait la dernière note terrain', () => {
    const recap = buildLeadRecap(lead());
    assert.equal(recap.note, 'Rappeler en septembre.');
  });

  it('ne invente pas de propriétaire', () => {
    const recap = buildLeadRecap(
      lead({ ownerName: null, ownerCompany: null, companyName: null }),
    );
    assert.equal(recap.who, 'Propriétaire non identifié');
  });
});
