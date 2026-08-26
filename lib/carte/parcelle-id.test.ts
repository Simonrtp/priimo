import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatParcelleId, normalizeParcelleId } from './parcelle-id';

describe('normalizeParcelleId', () => {
  it('normalise 14 caractères, majuscules, sans séparateur', () => {
    assert.equal(normalizeParcelleId('75111000ai0004'), '75111000AI0004');
    assert.equal(normalizeParcelleId('75111 000 AI 0004'), '75111000AI0004');
    assert.equal(normalizeParcelleId('75111-000-AI-0004'), '75111000AI0004');
  });

  it('rejette ce qui n’atteint pas 14 caractères', () => {
    assert.equal(normalizeParcelleId('123'), null);
    assert.equal(normalizeParcelleId('75111000AI000'), null);
    assert.equal(normalizeParcelleId('idu;drop'), null);
    assert.equal(normalizeParcelleId(''), null);
  });

  it('rejette un 15e caractère', () => {
    assert.equal(normalizeParcelleId('75111000AI00041'), null);
  });
});

describe('formatParcelleId', () => {
  it('aère la référence 14 caractères', () => {
    assert.equal(formatParcelleId('75111000AI0004'), '75111 000 AI 0004');
  });
});
