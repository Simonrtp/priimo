import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  imminenceExpirationMandat,
  joursAvantExpirationMandat,
  mandatExpirationDate,
  mandatExpireDansFenetre,
} from './mandat';

describe('mandat expiration', () => {
  const now = new Date('2026-08-20T12:00:00.000Z');

  it('calcule la date d’expiration simple (+3 mois)', () => {
    const exp = mandatExpirationDate('2026-05-20', 3);
    assert.equal(exp.toISOString().slice(0, 10), '2026-08-20');
  });

  it('détecte un mandat expirant dans 30 jours', () => {
    assert.ok(mandatExpireDansFenetre('2026-06-01', 3, now, 30));
    const jours = joursAvantExpirationMandat('2026-06-01', 3, now);
    assert.ok(jours <= 30);
    assert.ok(imminenceExpirationMandat(jours) > 0);
  });

  it('imminence à 100 le jour J', () => {
    assert.equal(imminenceExpirationMandat(0), 100);
  });
});
