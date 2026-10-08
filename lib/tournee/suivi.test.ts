import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  avancerSuivi,
  caloriesMarchees,
  mettreEnPause,
  reprendreSuivi,
  suiviNeuf,
  tempsActifMs,
  tourneeVraimentFaite,
} from './suivi';

/** 0.0001° de latitude ≈ 11 m. */
function point(dLat: number, t: number, accuracyM: number | null = 10) {
  return { latitude: 48.86 + dLat, longitude: 2.34, accuracyM, t };
}

describe('suivi de tournée', () => {
  it('ne compte rien tant que l’agent ne bouge pas', () => {
    let s = suiviNeuf(0);
    s = avancerSuivi(s, point(0, 0));
    s = avancerSuivi(s, point(0.00002, 30_000));
    assert.equal(s.distanceM, 0);
    assert.equal(caloriesMarchees(s.distanceM), 0);
  });

  it('additionne la marche', () => {
    let s = suiviNeuf(0);
    s = avancerSuivi(s, point(0, 0));
    s = avancerSuivi(s, point(0.001, 90_000));
    s = avancerSuivi(s, point(0.002, 180_000));
    assert.ok(Math.abs(s.distanceM - 222) < 3, `${s.distanceM}`);
  });

  it('ignore un trajet en voiture et un point imprécis', () => {
    let s = suiviNeuf(0);
    s = avancerSuivi(s, point(0, 0));
    s = avancerSuivi(s, point(0.01, 60_000));
    s = avancerSuivi(s, point(0.0105, 120_000, 80));
    assert.equal(s.distanceM, 0);
  });

  it('ne compte ni le temps ni le chemin de la pause', () => {
    let s = suiviNeuf(0);
    s = avancerSuivi(s, point(0, 0));
    s = mettreEnPause(s, 10 * 60_000);
    s = avancerSuivi(s, point(0.01, 20 * 60_000));
    s = reprendreSuivi(s, 30 * 60_000);
    s = avancerSuivi(s, point(0.02, 30 * 60_000));
    s = avancerSuivi(s, point(0.0205, 31 * 60_000));
    assert.equal(tempsActifMs(s, 31 * 60_000), 11 * 60_000);
    assert.ok(Math.abs(s.distanceM - 56) < 2, `${s.distanceM}`);
  });

  it('pas de bilan pour une tournée ouverte puis fermée', () => {
    assert.equal(tourneeVraimentFaite(suiviNeuf(0), 0), false);
    assert.equal(tourneeVraimentFaite(suiviNeuf(0), 1), true);
  });
});
