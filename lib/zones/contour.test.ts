import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  deplacerSommet,
  insererSommet,
  milieuxSegments,
  retirerSommet,
  sommetsManipulables,
} from './contour';

/** Carré unité, fermé comme le veut GeoJSON. */
function carre(): GeoJSON.Polygon {
  return {
    type: 'Polygon',
    coordinates: [
      [
        [0, 0],
        [4, 0],
        [4, 4],
        [0, 4],
        [0, 0],
      ],
    ],
  };
}

function anneau(polygone: GeoJSON.Polygon): number[][] {
  return polygone.coordinates[0]!;
}

function estFerme(polygone: GeoJSON.Polygon): boolean {
  const a = anneau(polygone);
  const premier = a[0]!;
  const dernier = a[a.length - 1]!;
  return premier[0] === dernier[0] && premier[1] === dernier[1];
}

describe('poignées d’un contour', () => {
  it('ne propose pas la fermeture comme un sommet de plus', () => {
    assert.deepEqual(sommetsManipulables(anneau(carre())), [
      [0, 0],
      [4, 0],
      [4, 4],
      [0, 4],
    ]);
  });

  it('ferme un anneau qui ne l’était pas avant de compter les sommets', () => {
    const ouvert = [
      [0, 0],
      [4, 0],
      [4, 4],
    ];
    assert.equal(sommetsManipulables(ouvert).length, 3);
  });

  it('pose un milieu par segment, fermeture comprise', () => {
    const milieux = milieuxSegments(anneau(carre()));
    assert.equal(milieux.length, 4);
    assert.deepEqual(milieux[0], { apres: 0, point: [2, 0] });
    assert.deepEqual(milieux[3], { apres: 3, point: [0, 2] });
  });
});

describe('déplacement d’un sommet', () => {
  it('tire le sommet et laisse les autres en place', () => {
    const bouge = deplacerSommet(carre(), 0, 1, [9, -1]);
    assert.deepEqual(anneau(bouge), [
      [0, 0],
      [9, -1],
      [4, 4],
      [0, 4],
      [0, 0],
    ]);
  });

  it('emmène la fermeture avec le premier sommet', () => {
    const bouge = deplacerSommet(carre(), 0, 0, [-2, -2]);
    assert.deepEqual(anneau(bouge)[0], [-2, -2]);
    assert.deepEqual(anneau(bouge)[4], [-2, -2]);
    assert.ok(estFerme(bouge));
  });

  it('ignore un index qui désigne la fermeture ou n’existe pas', () => {
    assert.deepEqual(deplacerSommet(carre(), 0, 4, [9, 9]), carre());
    assert.deepEqual(deplacerSommet(carre(), 0, -1, [9, 9]), carre());
    assert.deepEqual(deplacerSommet(carre(), 7, 1, [9, 9]), carre());
  });

  it('ne touche pas au polygone d’origine', () => {
    const origine = carre();
    deplacerSommet(origine, 0, 1, [9, 9]);
    assert.deepEqual(anneau(origine)[1], [4, 0]);
  });
});

describe('naissance d’un sommet', () => {
  it('insère juste après le segment tiré', () => {
    const tire = insererSommet(carre(), 0, 0, [2, -3]);
    assert.deepEqual(anneau(tire), [
      [0, 0],
      [2, -3],
      [4, 0],
      [4, 4],
      [0, 4],
      [0, 0],
    ]);
    assert.ok(estFerme(tire));
  });

  it('accepte le dernier segment, celui qui referme le contour', () => {
    const tire = insererSommet(carre(), 0, 3, [-3, 2]);
    assert.equal(anneau(tire).length, 6);
    assert.deepEqual(anneau(tire)[4], [-3, 2]);
    assert.ok(estFerme(tire));
  });

  it('refuse un segment qui n’existe pas', () => {
    assert.deepEqual(insererSommet(carre(), 0, 4, [1, 1]), carre());
  });
});

describe('retrait d’un sommet', () => {
  it('retire le sommet et garde l’anneau fermé', () => {
    const reduit = retirerSommet(carre(), 0, 2);
    assert.ok(reduit);
    assert.deepEqual(anneau(reduit), [
      [0, 0],
      [4, 0],
      [0, 4],
      [0, 0],
    ]);
  });

  it('recale la fermeture quand on retire le premier sommet', () => {
    const reduit = retirerSommet(carre(), 0, 0);
    assert.ok(reduit);
    assert.deepEqual(anneau(reduit), [
      [4, 0],
      [4, 4],
      [0, 4],
      [4, 0],
    ]);
    assert.ok(estFerme(reduit));
  });

  it('refuse de descendre sous trois sommets distincts', () => {
    const triangle: GeoJSON.Polygon = {
      type: 'Polygon',
      coordinates: [
        [
          [0, 0],
          [4, 0],
          [2, 3],
          [0, 0],
        ],
      ],
    };
    assert.equal(retirerSommet(triangle, 0, 1), null);
  });
});
