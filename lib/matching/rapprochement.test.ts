import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Contact, ContactType, SearchCriteria } from '../../types/contact';
import {
  RAPPROCHEMENT_CONFIG,
  evaluerCorrespondance,
  rapprocherAcquereurs,
  type RapprochableBien,
} from './rapprochement';

function acquereur(
  name: string,
  criteria: Partial<SearchCriteria>,
  type: ContactType = 'acquereur',
): Contact {
  return {
    id: name,
    agencyId: 'agency-a',
    createdBy: null,
    firstName: name,
    lastName: '',
    fullName: name,
    type,
    phone: null,
    email: null,
    secteur: null,
    criteria: {
      budgetMin: null,
      budgetMax: null,
      surfaceMin: null,
      surfaceMax: null,
      roomsMin: null,
      postalCodes: [],
      ...criteria,
    },
    summary: null,
    lastInteractionAt: null,
    source: 'manuel',
    address: null,
    banId: null,
    latitude: null,
    longitude: null,
    leadId: null,
    assignedTo: null,
    assignedBy: null,
    assignedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

const bien: RapprochableBien = {
  id: 'bien-1',
  address: '12 rue de la Monnaie',
  postalCode: '59000',
  price: 300_000,
  surfaceM2: 80,
  rooms: 4,
};

describe('evaluerCorrespondance', () => {
  it('retient un acquéreur dont tous les critères collent', () => {
    const match = evaluerCorrespondance(
      bien,
      acquereur('Alice', { budgetMax: 350_000, surfaceMin: 70, roomsMin: 3, postalCodes: ['59000'] }),
    );
    assert.ok(match);
    assert.equal(match.score, 100);
  });

  it('écarte un secteur qui ne correspond pas, même si tout le reste colle', () => {
    const match = evaluerCorrespondance(
      bien,
      acquereur('Bruno', { budgetMax: 400_000, postalCodes: ['75001'] }),
    );
    assert.equal(match, null);
  });

  it('écarte un bien trop cher au-delà de la tolérance', () => {
    // 300 000 > 250 000 × 1,1 = 275 000
    const match = evaluerCorrespondance(bien, acquereur('Chloé', { budgetMax: 250_000 }));
    assert.equal(match, null);
  });

  it('accepte un dépassement de budget dans la tolérance, avec un score dégradé', () => {
    // 300 000 ≤ 280 000 × 1,1 = 308 000
    const match = evaluerCorrespondance(bien, acquereur('David', { budgetMax: 280_000 }));
    assert.ok(match);
    assert.ok(match.score < 100);
    assert.ok(match.raisons.some((r) => r.includes('au-dessus du budget')));
  });

  it('écarte un bien nettement trop petit', () => {
    const match = evaluerCorrespondance(bien, acquereur('Emma', { surfaceMin: 120 }));
    assert.equal(match, null);
  });

  it('tolère une pièce de moins que demandé', () => {
    const avecTolerance = evaluerCorrespondance(bien, acquereur('Fanny', { roomsMin: 5 }));
    assert.ok(avecTolerance);

    const horsTolerance = evaluerCorrespondance(bien, acquereur('Gaël', { roomsMin: 6 }));
    assert.equal(horsTolerance, null);
  });

  it('ignore un contact qui n’est pas acquéreur', () => {
    const match = evaluerCorrespondance(bien, acquereur('Hugo', { budgetMax: 400_000 }, 'vendeur'));
    assert.equal(match, null);
  });

  it('ne propose jamais un acquéreur sans aucun critère', () => {
    const match = evaluerCorrespondance(bien, acquereur('Inès', {}));
    assert.equal(match, null);
  });

  it('ignore un critère que le bien ne renseigne pas', () => {
    const sansPrix: RapprochableBien = { ...bien, price: null };
    // Le budget n'est pas évaluable faute de prix : il ne peut donc pas rejeter.
    // La surface, elle, colle, et suffit à retenir la correspondance.
    const match = evaluerCorrespondance(
      sansPrix,
      acquereur('Jade', { budgetMax: 100_000, surfaceMin: 70 }),
    );
    assert.ok(match);
    assert.ok(!match.raisons.some((r) => r.includes('budget')));
  });
});

describe('rapprocherAcquereurs', () => {
  it('classe du meilleur au moins bon et respecte le plafond', () => {
    const contacts = [
      acquereur('Approximatif', { budgetMax: 280_000, postalCodes: ['59000'] }),
      acquereur('Parfait', { budgetMax: 350_000, surfaceMin: 70, postalCodes: ['59000'] }),
    ];

    const matches = rapprocherAcquereurs(bien, contacts);
    assert.equal(matches.length, 2);
    assert.equal(matches[0]?.contact.fullName, 'Parfait');

    const plafonne = rapprocherAcquereurs(bien, contacts, {
      ...RAPPROCHEMENT_CONFIG,
      maxAcquereursParBien: 1,
    });
    assert.equal(plafonne.length, 1);
  });
});
