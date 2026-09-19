import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DVF_HORIZON_ANS,
  dvfHorizonDepuisIso,
  ESTIMATION_SOURCE_CATALOG,
  ESTIMATION_SOURCES_DISCLAIMER,
  normalizeEstimationSources,
  resolveEstimationSources,
  sourcesFromContext,
} from './sources';

describe('estimation sources', () => {
  it('garde le catalogue à six entrées fixes', () => {
    assert.equal(ESTIMATION_SOURCE_CATALOG.length, 6);
    assert.ok(ESTIMATION_SOURCES_DISCLAIMER.includes('sans caution'));
    assert.equal(DVF_HORIZON_ANS, 5);
    assert.ok(ESTIMATION_SOURCE_CATALOG[0]!.subtitle.includes('5 dernières années'));
  });

  it('borne la fenêtre DVF à cinq ans', () => {
    assert.equal(dvfHorizonDepuisIso(new Date('2026-09-19T12:00:00Z')), '2021-09-19');
  });

  it('filtre et ordonne selon le catalogue', () => {
    assert.deepEqual(normalizeEstimationSources(['bienici', 'dvf', 'inconnu', 'dpe']), [
      'dvf',
      'dpe',
      'bienici',
    ]);
  });

  it('lit les sources depuis le context persisté', () => {
    assert.deepEqual(sourcesFromContext({ sources: ['cadastre', 'dvf'] }), ['dvf', 'cadastre']);
    assert.deepEqual(sourcesFromContext({}), []);
  });

  it('ne résout rien si la liste est vide', () => {
    assert.deepEqual(resolveEstimationSources([]), []);
  });
});
