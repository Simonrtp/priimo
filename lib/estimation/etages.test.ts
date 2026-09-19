import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { inferDernierEtage, numeroEtage } from './etages';

describe('inferDernierEtage', () => {
  it('2e étage dans un immeuble de 3 → non', () => {
    assert.equal(inferDernierEtage('2', 3), false);
  });

  it('3e étage dans un immeuble de 3 → oui', () => {
    assert.equal(inferDernierEtage('3', 3), true);
  });

  it('RDC n’est pas le dernier dès qu’il y a des étages', () => {
    assert.equal(inferDernierEtage('RDC', 3), false);
    assert.equal(inferDernierEtage('RDC', 1), false);
  });

  it('ne devine pas si un champ manque', () => {
    assert.equal(inferDernierEtage('2', null), null);
    assert.equal(inferDernierEtage(null, 3), null);
  });

  it('lit le numéro d’étage', () => {
    assert.equal(numeroEtage('RDC'), 0);
    assert.equal(numeroEtage('2'), 2);
    assert.equal(numeroEtage('20+'), 20);
  });
});
