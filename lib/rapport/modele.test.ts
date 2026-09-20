import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { normaliserCouleurPrincipale } from './identite';
import {
  libelleKindPage,
  nomDepuisContenu,
  normaliserContenu,
  visuelPage,
} from './modele';
import { couperLignes } from './pdf-texte';
import { corpsEstVide, corpsVersHtml, normaliserCorps } from './texte-riche';

describe('pages créées — champs vides', () => {
  it('fait disparaître titre, corps et points vides', () => {
    const visuel = visuelPage({
      titre: '   ',
      corps: [{ type: 'p', runs: [{ text: '  ' }] }],
      points: [
        { intitule: '', description: '' },
        { intitule: 'Réactivité', description: '  ' },
        { intitule: '', description: 'Une ligne utile' },
      ],
    });
    assert.equal(visuel.titre, null);
    assert.deepEqual(visuel.corps, []);
    assert.deepEqual(visuel.points, [
      { intitule: 'Réactivité', description: null },
      { intitule: null, description: 'Une ligne utile' },
    ]);
  });

  it('normalise un JSON partiel', () => {
    const contenu = normaliserContenu({
      titre: 'Notre méthode',
      imageCote: 'gauche',
      corps: [{ type: 'p', runs: [{ text: 'Bonjour', gras: true }] }],
    });
    assert.equal(contenu.titre, 'Notre méthode');
    assert.equal(contenu.imageCote, 'gauche');
    assert.equal(contenu.corps?.[0]?.type, 'p');
  });

  it('nomme la page d’après le titre, sinon la disposition', () => {
    assert.equal(nomDepuisContenu({ titre: 'Conditions' }, 'texte'), 'Conditions');
    assert.equal(nomDepuisContenu({}, 'points'), 'Points clés');
  });

  it('étiquette le kind pour la liste', () => {
    assert.equal(libelleKindPage('modele', 'texte_image'), 'Texte et image');
    assert.equal(libelleKindPage('pdf', null, 3), 'PDF · 3 pages');
  });
});

describe('texte riche', () => {
  it('ignore les blocs vides', () => {
    const corps = normaliserCorps([
      { type: 'p', runs: [{ text: '' }] },
      { type: 'ul', items: [[{ text: 'A' }], [{ text: '  ' }]] },
    ]);
    assert.equal(corps.length, 1);
    assert.equal(corps[0]?.type, 'ul');
    assert.equal(corpsEstVide(corps), false);
    assert.match(corpsVersHtml(corps), /<li>A<\/li>/);
  });
});

describe('couleur principale', () => {
  it('n’accepte qu’un hex, sinon l’orange Priimo', () => {
    assert.equal(normaliserCouleurPrincipale('#1a2b3c'), '#1A2B3C');
    assert.equal(normaliserCouleurPrincipale('orange'), '#E8743C');
    assert.equal(normaliserCouleurPrincipale('#fff'), '#E8743C');
  });
});

describe('découpe PDF', () => {
  it('coupe sans mot perdu', () => {
    const lines = couperLignes('un deux trois quatre', (s) => s.length * 10, 35);
    assert.ok(lines.length >= 2);
    assert.equal(lines.join(' '), 'un deux trois quatre');
  });
});
