import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { extrasCoefficients, extrasTotalPct, parseExtras } from './extras';

describe('extrasCoefficients — appartement', () => {
  it('valorise le duplex', () => {
    const coeffs = extrasCoefficients('appartement', { duplex: true });
    assert.deepEqual(
      coeffs.map((c) => c.id),
      ['duplex'],
    );
    assert.ok(coeffs[0]!.pct > 0);
  });

  it('ne prime que les terrasses réellement généreuses', () => {
    assert.equal(extrasCoefficients('appartement', { balconM2: 6 }).length, 0);
    const grande = extrasCoefficients('appartement', { balconM2: 20 });
    assert.equal(grande[0]?.id, 'grande_terrasse');
    assert.ok(grande[0]!.label.includes('20 m²'));
  });

  it('ignore les critères de maison sur un appartement', () => {
    const coeffs = extrasCoefficients('appartement', {
      terrainM2: 800,
      garagePlaces: 2,
      dependances: true,
    });
    assert.equal(coeffs.length, 0);
  });

  it('ne tire aucun coefficient des charges, faute de référence locale', () => {
    assert.equal(extrasCoefficients('appartement', { chargesMensuelles: 400 }).length, 0);
  });
});

describe('extrasCoefficients — maison', () => {
  it('valorise le terrain par tranche, avec un plafond', () => {
    const petit = extrasCoefficients('maison', { terrainM2: 300 })[0]!;
    const grand = extrasCoefficients('maison', { terrainM2: 5000 })[0]!;
    assert.ok(grand.pct > petit.pct);
    assert.ok(grand.pct <= 0.1);
  });

  it('distingue un sous-sol aménagé d’un sous-sol brut', () => {
    const amenage = extrasCoefficients('maison', { sousSol: true, sousSolAmenage: true })[0]!;
    const brut = extrasCoefficients('maison', { sousSol: true })[0]!;
    assert.ok(amenage.pct > brut.pct);
    assert.ok(amenage.label.includes('aménagé'));
  });

  it('compte la première place de garage plus que les suivantes', () => {
    const une = extrasCoefficients('maison', { garagePlaces: 1 })[0]!;
    const deux = extrasCoefficients('maison', { garagePlaces: 2 })[0]!;
    const dix = extrasCoefficients('maison', { garagePlaces: 10 })[0]!;
    assert.ok(deux.pct > une.pct);
    assert.ok(dix.pct <= 0.06);
    assert.ok(deux.label.includes('2 places'));
  });

  it('n’attribue aucun coefficient au nombre de niveaux', () => {
    assert.equal(extrasCoefficients('maison', { niveaux: 3 }).length, 0);
  });

  it('cumule les critères présents', () => {
    const coeffs = extrasCoefficients('maison', {
      terrainM2: 600,
      sousSol: true,
      sousSolAmenage: true,
      garagePlaces: 2,
      dependances: true,
    });
    assert.deepEqual(
      coeffs.map((c) => c.id),
      ['terrain', 'sous_sol', 'garage', 'dependances'],
    );
    assert.ok(extrasTotalPct(coeffs) > 0.1);
  });
});

describe('parseExtras', () => {
  it('ne retient que des nombres positifs', () => {
    const extras = parseExtras({ terrainM2: '-5', garagePlaces: '2', sousSolM2: 'abc' });
    assert.equal(extras?.terrainM2, null);
    assert.equal(extras?.garagePlaces, 2);
    assert.equal(extras?.sousSolM2, null);
  });

  it('ne renvoie rien sur une entrée inexploitable', () => {
    assert.equal(parseExtras(null), null);
    assert.equal(parseExtras('duplex'), null);
  });

  it('n’accepte les booléens que stricts', () => {
    const extras = parseExtras({ duplex: 'oui', dependances: true });
    assert.equal(extras?.duplex, false);
    assert.equal(extras?.dependances, true);
  });
});
