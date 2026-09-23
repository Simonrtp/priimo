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
          kindGeneree: null,
          manques: [],
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

  it('produit un PDF même si les pages générées passent par le repli', async () => {
    const bytes = await genererPdfRapport({
      agence: {
        nom: 'SARL Test',
        nomCommercial: 'Agence Test',
        adresse: null,
        telephone: null,
        email: null,
        siteWeb: null,
        logoUrl: null,
        couleurPrincipale: '#E8743C',
      },
      agent: { nom: 'Marie Durand', email: null, telephone: null, photoUrl: null },
      bien: { adresse: '12 rue X', ville: 'Paris' },
      pages: [
        {
          id: 'g1',
          source: 'generee',
          bibliothequeId: null,
          nom: 'Prix',
          kind: 'generee',
          storagePath: null,
          mimeType: null,
          pageIndex: 0,
          position: 0,
          previewUrl: null,
          kindGeneree: 'prix',
          manques: [],
          disposition: null,
          contenu: null,
        },
      ],
      dossier: {
        titreCouverture: 'Avis de valeur',
        ctaProchaineEtape: 'Contactez-nous.',
        dateEvaluation: '2026-09-12',
        adresse: '12 rue X 75011 Paris',
        city: 'Paris',
        postalCode: '75011',
        propertyType: 'appartement',
        surfaceM2: 76,
        surfaceCarrez: 74,
        rooms: 3,
        floor: '3',
        occupation: 'libre',
        dpeClass: 'D',
        gesClass: null,
        etatLibelle: null,
        balconTerrasse: null,
        commentairesPublics: null,
        remarquesExpert: null,
        etagesImmeuble: 6,
        anneeConstruction: 1972,
        ascenseur: true,
        chambres: 2,
        annexes: [],
        photos: [],
        photoCouverture: null,
        latitude: null,
        longitude: null,
        priceValue: 546000,
        priceLow: 500000,
        priceHigh: 590000,
        pricePerM2: 7579,
        surfacePrixLibelle: 'Carrez',
        fourchetteAjoutee: false,
        client: { prenom: 'Marie', nom: 'Durand', telephone: null, email: null },
        agence: {
          nom: 'SARL Test',
          nomCommercial: 'Agence Test',
          adresse: null,
          telephone: null,
          email: null,
          siteWeb: null,
          logoUrl: null,
          couleurPrincipale: '#E8743C',
        },
        agent: { nom: 'Marie Durand', email: null, telephone: null, photoUrl: null },
        comparables: [],
        comparablesReserve: [],
        annonces: [],
        annoncesReserve: [],
        iris: null,
        equipements: [],
        fixe: [],
        mobile: [],
        permis: [],
        oat: [],
        effort: null,
        fluiditeJoursMedian: null,
        negotiationPctMedian: null,
        contradictions: [],
      },
    });
    assert.ok(bytes.byteLength > 400);
    assert.equal(String.fromCharCode(...bytes.slice(0, 4)), '%PDF');
  });
});
