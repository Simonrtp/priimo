import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DISPERSION_MESSAGE,
  FIABILITE_LABEL,
  niveauFiabilite,
  phraseComparables,
  phraseImmeuble,
} from './resultat';
import { dispersionRatio, isDispersionElevee, trimestreLabel } from './dvf-engine';

describe('phraseComparables', () => {
  it('écrit ce dont on dispose, pas ce qui manque', () => {
    const phrase = phraseComparables({
      comparables: 13,
      radiusM: 200,
      trimestre: '2e trimestre 2026',
      immeubleVentes: 0,
    });
    assert.equal(phrase, '13 ventes comparables dans un rayon de 200 m, réactualisées au 2e trimestre 2026');
    assert.ok(!phrase.includes('dont 0'));
  });

  it('se passe de la période quand elle est inconnue', () => {
    assert.equal(
      phraseComparables({ comparables: 1, radiusM: 200, trimestre: null, immeubleVentes: 0 }),
      '1 vente comparable dans un rayon de 200 m',
    );
  });

  it('ne mentionne l’immeuble que s’il apporte quelque chose', () => {
    const base = { comparables: 13, radiusM: 200, trimestre: null };
    assert.equal(phraseImmeuble({ ...base, immeubleVentes: 0 }), null);
    assert.equal(phraseImmeuble({ ...base, immeubleVentes: 2 }), 'dont 2 dans l’immeuble');
  });
});

describe('niveau de fiabilité', () => {
  it('se lit en trois paliers', () => {
    assert.equal(FIABILITE_LABEL[niveauFiabilite(85)], 'Fiabilité élevée');
    assert.equal(FIABILITE_LABEL[niveauFiabilite(55)], 'Fiabilité correcte');
    assert.equal(FIABILITE_LABEL[niveauFiabilite(20)], 'Fiabilité limitée');
  });
});

describe('dispersion des prix au m²', () => {
  it('reste muette sur un échantillon trop petit', () => {
    assert.equal(dispersionRatio([4000, 4200, 4100]), null);
    assert.equal(isDispersionElevee(null), false);
  });

  it('accepte un secteur homogène', () => {
    const ratio = dispersionRatio([4000, 4100, 4150, 4200, 4250, 4300, 4350, 4400]);
    assert.ok(ratio != null && ratio < 0.35);
    assert.equal(isDispersionElevee(ratio), false);
  });

  it('signale un secteur hétérogène', () => {
    const ratio = dispersionRatio([2000, 2500, 3000, 5000, 7000, 9000, 11000, 13000]);
    assert.ok(ratio != null && ratio > 0.35);
    assert.equal(isDispersionElevee(ratio), true);
    assert.ok(DISPERSION_MESSAGE.includes('visite'));
  });
});

describe('trimestreLabel', () => {
  it('nomme le trimestre de la vente la plus récente', () => {
    assert.equal(trimestreLabel('2026-05-14'), '2e trimestre 2026');
    assert.equal(trimestreLabel('2026-01-02'), '1er trimestre 2026');
    assert.equal(trimestreLabel('2025-12-31'), '4e trimestre 2025');
  });

  it('ne devine rien sans date', () => {
    assert.equal(trimestreLabel(null), null);
    assert.equal(trimestreLabel('pas une date'), null);
  });
});
