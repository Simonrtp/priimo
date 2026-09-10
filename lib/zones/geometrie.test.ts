import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { bbox, centrePolygone, chevauchements, polygonesSeChevauchent } from './geometrie';
import type { RegleZone, ValeurPolygone, Zone } from './types';

function rect(ouest: number, sud: number, est: number, nord: number): ValeurPolygone {
  return {
    type: 'Polygon',
    coordinates: [
      [
        [ouest, sud],
        [est, sud],
        [est, nord],
        [ouest, nord],
        [ouest, sud],
      ],
    ],
  };
}

function zone(id: string, polygones: ValeurPolygone[], actif = true): Zone {
  const regles: RegleZone[] = polygones.map((valeur, i) => ({
    id: `${id}-r${i}`,
    zoneId: id,
    inclusion: true,
    type: 'polygone',
    valeur,
  }));
  return {
    id,
    agencyId: 'a1',
    nom: `Zone ${id}`,
    couleur: '#4C7A9E',
    assignedTo: null,
    jourSemaine: null,
    actif,
    verrouillee: false,
    regles,
  };
}

describe('emprise et centre', () => {
  it('encadre un contour', () => {
    assert.deepEqual(bbox(rect(2.3, 48.8, 2.4, 48.9)), {
      ouest: 2.3,
      sud: 48.8,
      est: 2.4,
      nord: 48.9,
    });
  });

  it('rend null sur un contour dégénéré', () => {
    assert.equal(bbox({ type: 'Polygon', coordinates: [[[2.3, 48.8]]] }), null);
  });

  it('place le centre au milieu de l’emprise', () => {
    assert.deepEqual(centrePolygone(rect(2.3, 48.8, 2.5, 49)), {
      latitude: 48.9,
      longitude: 2.4,
    });
  });
});

describe('recouvrement de deux contours', () => {
  it('voit deux rectangles qui se mordent', () => {
    assert.equal(polygonesSeChevauchent(rect(2.3, 48.8, 2.4, 48.9), rect(2.35, 48.85, 2.5, 49)), true);
  });

  it('laisse tranquilles deux rectangles séparés', () => {
    assert.equal(polygonesSeChevauchent(rect(2.3, 48.8, 2.4, 48.9), rect(2.5, 48.8, 2.6, 48.9)), false);
  });

  it('ne signale pas deux secteurs simplement jointifs', () => {
    // Bord commun : c'est un pavage, pas un conflit.
    assert.equal(polygonesSeChevauchent(rect(2.3, 48.8, 2.4, 48.9), rect(2.4, 48.8, 2.5, 48.9)), false);
  });

  it('voit un contour entièrement contenu dans l’autre', () => {
    assert.equal(polygonesSeChevauchent(rect(2.3, 48.8, 2.5, 49), rect(2.35, 48.85, 2.4, 48.9)), true);
  });

  it('voit deux bandes en croix, sans sommet chez le voisin', () => {
    const horizontale = rect(2.0, 48.85, 2.8, 48.87);
    const verticale = rect(2.4, 48.5, 2.42, 49.2);
    assert.equal(polygonesSeChevauchent(horizontale, verticale), true);
  });
});

describe('alerte de chevauchement entre zones', () => {
  it('nomme les deux zones en conflit', () => {
    const conflits = chevauchements([
      zone('a', [rect(2.3, 48.8, 2.4, 48.9)]),
      zone('b', [rect(2.35, 48.85, 2.5, 49)]),
      zone('c', [rect(2.6, 48.8, 2.7, 48.9)]),
    ]);
    assert.equal(conflits.length, 1);
    assert.deepEqual([conflits[0]!.zoneA.id, conflits[0]!.zoneB.id], ['a', 'b']);
  });

  it('ignore une zone désactivée', () => {
    const conflits = chevauchements([
      zone('a', [rect(2.3, 48.8, 2.4, 48.9)]),
      zone('b', [rect(2.35, 48.85, 2.5, 49)], false),
    ]);
    assert.deepEqual(conflits, []);
  });

  it('ne compte pas les règles d’exclusion comme des conflits', () => {
    const a = zone('a', [rect(2.3, 48.8, 2.4, 48.9)]);
    const b = zone('b', []);
    const retrait: RegleZone = {
      id: 'b-r0',
      zoneId: 'b',
      inclusion: false,
      type: 'polygone',
      valeur: rect(2.35, 48.85, 2.5, 49),
    };
    assert.deepEqual(chevauchements([a, { ...b, regles: [retrait] }]), []);
  });

  it('ne signale rien sans aucun contour', () => {
    assert.deepEqual(chevauchements([zone('a', [])]), []);
  });
});
