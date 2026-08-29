import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildCorrectionLines } from './corrections';
import { PROGRESS_TOTAL, progressIndex, questionStepsFor } from './parcours';

describe('parcours estimation', () => {
  it('regroupe appartement en 6 questions', () => {
    assert.deepEqual(questionStepsFor('appartement'), [
      'adresse',
      'type',
      'surface_pieces',
      'etage_ascenseur',
      'annexes_appart',
      'etat_dpe',
    ]);
  });

  it('regroupe maison en 6 questions', () => {
    assert.deepEqual(questionStepsFor('maison'), [
      'adresse',
      'type',
      'surface_pieces',
      'niveaux_terrain',
      'annexes_maison',
      'etat_dpe',
    ]);
  });

  it('compte 8 crans de progression, à 0 sur l’adresse', () => {
    assert.equal(PROGRESS_TOTAL, 8);
    assert.equal(progressIndex('adresse'), 0);
    assert.equal(progressIndex('type'), 1);
    assert.equal(progressIndex('resultat'), 7);
  });
});

describe('buildCorrectionLines', () => {
  it('produit base + ajustements + total', () => {
    const lines = buildCorrectionLines(
      {
        surfaceM2: 76,
        medianPm2: 9130,
        propertyType: 'appartement',
        floor: '4',
        hasElevator: true,
        dpeClass: 'D',
        conditionRating: null,
        hasParking: true,
        hasCave: false,
        hasBalconTerrasse: false,
        quartierVentes: 24,
      },
      { floor: 0.03, dpe: 0, condition: 0, features: 0.04 },
    );
    assert.equal(lines[0]?.kind, 'base');
    assert.ok(lines.some((l) => l.id === 'etage'));
    assert.ok(lines.some((l) => l.id === 'parking'));
    assert.equal(lines.at(-1)?.kind, 'total');
  });
});
