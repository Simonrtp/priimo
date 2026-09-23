import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ACCENT2_DEFAUT,
  ACCENT_DEFAUT,
  NUANCIER_ACCENT,
  NUANCIER_ACCENT2,
  decouperTitre,
  normaliserAccent,
  normaliserAccent2,
} from './couleurs';

describe('nuanciers de l’avis', () => {
  it('propose les couleurs de la maquette David Valor', () => {
    assert.ok(NUANCIER_ACCENT.some((c) => c.hex === ACCENT_DEFAUT));
    assert.ok(NUANCIER_ACCENT.some((c) => c.hex === '#E8743C'));
    assert.ok(NUANCIER_ACCENT2.some((c) => c.hex === ACCENT2_DEFAUT));
    assert.equal(normaliserAccent(null), ACCENT_DEFAUT);
    assert.equal(normaliserAccent2('bleu'), ACCENT2_DEFAUT);
    assert.equal(normaliserAccent('#14aed6'), '#14AED6');
  });

  it('découpe les titres comme l’en-tête v2', () => {
    assert.deepEqual(decouperTitre('Votre bien'), { bold: 'Votre', light: 'bien' });
    assert.deepEqual(decouperTitre('Notre estimation'), { bold: 'Notre', light: 'estimation' });
    assert.deepEqual(decouperTitre('Ventes comparables'), { bold: 'Les ventes', light: 'comparables' });
  });
});
