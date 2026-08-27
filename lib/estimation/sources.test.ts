import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
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
