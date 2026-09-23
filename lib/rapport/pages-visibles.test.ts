import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { estPageTestBibliotheque } from './modele-defaut';
import { indicesPagesChrome, retenirPagesUniques } from './pages-visibles';

describe('pages visibles du rapport', () => {
  it('retire les pages absorbées et les doublons de kind', () => {
    const { gardees, retirees } = retenirPagesUniques([
      { id: '1', kind: 'generee', kindGeneree: 'couverture', contenu: { kind: 'couverture' } },
      { id: '2', kind: 'generee', kindGeneree: 'votre_bien', contenu: { kind: 'votre_bien' } },
      { id: '3', kind: 'generee', kindGeneree: 'description', contenu: { kind: 'description' } },
      { id: '4', kind: 'generee', kindGeneree: 'votre_bien', contenu: { kind: 'votre_bien' } },
      { id: '5', kind: 'generee', kindGeneree: 'prochaine_etape', contenu: { kind: 'prochaine_etape' } },
    ]);
    assert.deepEqual(
      gardees.map((p) => p.id),
      ['1', '2'],
    );
    assert.deepEqual(
      retirees.map((p) => p.id),
      ['3', '4', '5'],
    );
  });

  it('retire la capture Alan / Hello du livrable', () => {
    assert.equal(estPageTestBibliotheque('Hello, dans ton secteur'), true);
    assert.equal(estPageTestBibliotheque('Capture Alan'), true);
    assert.equal(estPageTestBibliotheque('Présentation agence'), false);
    const { gardees } = retenirPagesUniques([
      { id: 'b', kind: 'image', nom: 'Hello, dans ton secteur' },
      { id: 'ok', kind: 'image', nom: 'Mentions légales' },
    ]);
    assert.deepEqual(
      gardees.map((p) => p.id),
      ['ok'],
    );
  });

  it('prend une page Chromium sur deux quand chaque section a une feuille vide', () => {
    assert.deepEqual(indicesPagesChrome(14, 7), [0, 2, 4, 6, 8, 10, 12]);
    assert.deepEqual(indicesPagesChrome(7, 7), [0, 1, 2, 3, 4, 5, 6]);
    assert.deepEqual(indicesPagesChrome(0, 7), []);
  });
});
