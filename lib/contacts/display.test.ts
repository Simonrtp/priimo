import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Contact } from '@/types/contact';
import {
  formatAcquereurCriteria,
  formatContactMeta,
  formatLastInteraction,
  formatVendeurMeta,
} from './display';

const NOW = Date.parse('2026-08-26T10:00:00.000Z');

describe('formatAcquereurCriteria', () => {
  it('aligne budget, pièces, surface et codes postaux', () => {
    const line = formatAcquereurCriteria({
      budgetMin: 200_000,
      budgetMax: 350_000,
      surfaceMin: 70,
      surfaceMax: null,
      roomsMin: 3,
      postalCodes: ['59000', '59800'],
    });
    assert.match(line, /200 k€/);
    assert.match(line, /350 k€/);
    assert.match(line, /3 p\. min/);
    assert.match(line, /70 m² min/);
    assert.match(line, /59000/);
  });
});

describe('formatVendeurMeta', () => {
  it('préfère le bien au lead', () => {
    assert.equal(
      formatVendeurMeta({
        mandatStatut: 'mandat_simple',
        bienAddress: '12 rue de la Monnaie',
        leadAddress: 'autre',
      }),
      'Mandat simple · 12 rue de la Monnaie',
    );
  });

  it('tombe sur le lead d’origine', () => {
    assert.equal(
      formatVendeurMeta({
        mandatStatut: null,
        bienAddress: null,
        leadAddress: '8 rue du Lead',
      }),
      'Lead · 8 rue du Lead',
    );
  });
});

describe('formatLastInteraction', () => {
  it('ne dit pas « Vu » pour une consultation de fiche', () => {
    const line = formatLastInteraction(
      { kind: 'appel', occurredAt: '2026-08-20T10:00:00.000Z' },
      NOW,
    );
    assert.equal(line, 'Appelé il y a 6 j');
    assert.equal(formatLastInteraction(null, NOW), 'Aucun échange');
  });
});

describe('formatContactMeta', () => {
  it('pose les critères d’un acquéreur avant l’assigné', () => {
    const contact = {
      type: 'acquereur',
      secteur: 'Vieux Lille',
      address: null,
      criteria: {
        budgetMin: null,
        budgetMax: 400_000,
        surfaceMin: 60,
        surfaceMax: null,
        roomsMin: 2,
        postalCodes: ['59000'],
      },
    } as Contact;
    const line = formatContactMeta(contact, {
      assigneeName: 'Marie',
      mandatStatut: null,
      bienAddress: null,
      leadAddress: null,
    });
    assert.match(line, /jusqu’à 400 k€/);
    assert.match(line, /Marie/);
    assert.doesNotMatch(line, /Vieux Lille/);
  });
});
