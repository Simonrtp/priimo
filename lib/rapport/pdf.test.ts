import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { genererPdfRapport } from './pdf';

describe('export PDF rapport', () => {
  it('produit un PDF paysage même sans page composée', async () => {
    const bytes = await genererPdfRapport({
      agence: {
        nom: 'SARL Test',
        nomCommercial: 'Agence Test',
        adresse: '12 rue de la Paix',
        telephone: null,
        email: null,
        siteWeb: null,
        logoUrl: null,
      },
      agent: { nom: 'Marie Durand', email: null, telephone: null, photoUrl: null },
      bien: { adresse: null, ville: 'Nantes' },
      pages: [],
    });
    assert.ok(bytes.byteLength > 200);
    assert.equal(String.fromCharCode(...bytes.slice(0, 4)), '%PDF');
  });
});
