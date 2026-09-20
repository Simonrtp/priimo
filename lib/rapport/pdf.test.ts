import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PDFDocument } from 'pdf-lib';
import { compterPagesPdf, genererPdfRapport } from './pdf';

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
        couleurPrincipale: '#E8743C',
      },
      agent: { nom: 'Marie Durand', email: null, telephone: null, photoUrl: null },
      bien: { adresse: null, ville: 'Nantes' },
      pages: [],
    });
    assert.ok(bytes.byteLength > 200);
    assert.equal(String.fromCharCode(...bytes.slice(0, 4)), '%PDF');
  });

  it('compte les pages d’un PDF importé', async () => {
    const src = await PDFDocument.create();
    src.addPage([595, 842]);
    src.addPage([595, 842]);
    src.addPage([595, 842]);
    const bytes = await src.save();
    assert.equal(await compterPagesPdf(bytes), 3);
  });

  it('dessine une page créée partiellement remplie', async () => {
    const bytes = await genererPdfRapport({
      agence: {
        nom: 'SARL Test',
        nomCommercial: 'Agence Test',
        adresse: null,
        telephone: null,
        email: null,
        siteWeb: null,
        logoUrl: null,
        couleurPrincipale: '#1A6B4A',
      },
      agent: { nom: 'Marie Durand', email: null, telephone: null, photoUrl: null },
      bien: { adresse: null, ville: 'Nantes' },
      pages: [
        {
          id: 'p1',
          source: 'bibliotheque',
          bibliothequeId: null,
          nom: 'Méthode',
          kind: 'modele',
          storagePath: null,
          mimeType: null,
          pageIndex: 0,
          position: 0,
          previewUrl: null,
          disposition: 'texte',
          contenu: {
            titre: 'Notre méthode',
            corps: [{ type: 'p', runs: [{ text: 'Un paragraphe.' }] }],
          },
        },
      ],
    });
    assert.ok(bytes.byteLength > 400);
    assert.equal(String.fromCharCode(...bytes.slice(0, 4)), '%PDF');
  });
});
