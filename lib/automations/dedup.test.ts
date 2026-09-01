import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { dedupKey, jourDe, moisDe, semaineDe } from './dedup';

describe('dedupKey', () => {
  it('normalise les fragments pour rester stable', () => {
    assert.equal(dedupKey('veille_dpe', '2287E0123456X'), 'veille_dpe:2287e0123456x');
    assert.equal(dedupKey('veille_dpe', ' 12 Rue de la Paix '), 'veille_dpe:12-rue-de-la-paix');
  });

  it('produit la même clé pour le même signal', () => {
    assert.equal(
      dedupKey('rapprochement_inverse', 'contact-1', 'bien-2'),
      dedupKey('rapprochement_inverse', 'Contact-1', 'BIEN-2'),
    );
  });

  it('distingue deux signaux différents', () => {
    assert.notEqual(
      dedupKey('rapprochement_inverse', 'contact-1', 'bien-2'),
      dedupKey('rapprochement_inverse', 'contact-1', 'bien-3'),
    );
  });

  it('supporte une clé sans fragment', () => {
    assert.equal(dedupKey('veille_dpe'), 'veille_dpe');
  });
});

describe('périodes', () => {
  it('mois sur deux chiffres', () => {
    assert.equal(moisDe(new Date('2026-01-05T00:00:00Z')), '2026-01');
    assert.equal(moisDe(new Date('2026-12-31T23:00:00Z')), '2026-12');
  });

  it('semaine ISO', () => {
    // 1er janvier 2026 = jeudi → semaine 1.
    assert.equal(semaineDe(new Date('2026-01-01T00:00:00Z')), '2026-W01');
    assert.equal(semaineDe(new Date('2026-08-31T00:00:00Z')), '2026-W36');
  });

  it('une clé mensuelle change de mois en mois', () => {
    const aout = dedupKey('compte_rendu_mandat', 'bien-1', moisDe(new Date('2026-08-10T00:00:00Z')));
    const septembre = dedupKey('compte_rendu_mandat', 'bien-1', moisDe(new Date('2026-09-10T00:00:00Z')));
    assert.notEqual(aout, septembre);
  });

  it('jour ISO', () => {
    assert.equal(jourDe(new Date('2026-08-31T22:15:00Z')), '2026-08-31');
  });
});
