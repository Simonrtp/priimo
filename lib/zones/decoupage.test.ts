import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { depuisTroisMois, proposerDecoupage } from './decoupage';
import { pointDansPolygone } from './appartenance';
import { polygonesSeChevauchent } from './geometrie';
import { COULEURS_ZONE } from './palette';

/** Grille régulière de leads : 100 adresses sur un carré parisien. */
function grille(n: number) {
  const points: { latitude: number; longitude: number }[] = [];
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < n; j += 1) {
      points.push({ latitude: 48.84 + i * 0.002, longitude: 2.38 + j * 0.002 });
    }
  }
  return points;
}

describe('découpage proposé', () => {
  it('rend exactement le nombre de secteurs demandé', () => {
    for (const n of [1, 2, 3, 4, 5, 8]) {
      const zones = proposerDecoupage(grille(10), n);
      assert.equal(zones.length, n, `${n} secteurs demandés`);
    }
  });

  it('équilibre les leads à une unité près', () => {
    const leads = grille(10); // 100 leads
    const zones = proposerDecoupage(leads, 4);
    for (const zone of zones) {
      assert.equal(zone.nbLeads, 25, `${zone.nom} : ${zone.nbLeads} leads`);
    }
  });

  it('équilibre aussi sur un nombre impair de secteurs', () => {
    const zones = proposerDecoupage(grille(10), 3);
    const compte = zones.map((z) => z.nbLeads).sort((a, b) => a - b);
    assert.equal(compte.reduce((a, b) => a + b, 0), 100);
    // 100 sur 3 : 33 ou 34, jamais 10 contre 60.
    assert.ok(compte[compte.length - 1]! - compte[0]! <= 1, `écart ${compte.join('/')}`);
  });

  it('ne laisse aucun lead hors des contours proposés', () => {
    const leads = grille(8);
    const zones = proposerDecoupage(leads, 4);
    for (const lead of leads) {
      const dedans = zones.filter((z) => pointDansPolygone(lead, z.polygone));
      assert.equal(dedans.length, 1, `lead ${lead.latitude}/${lead.longitude}`);
    }
  });

  it('ne propose jamais deux secteurs qui se recouvrent', () => {
    const zones = proposerDecoupage(grille(8), 4);
    for (let i = 0; i < zones.length; i += 1) {
      for (let j = i + 1; j < zones.length; j += 1) {
        assert.equal(
          polygonesSeChevauchent(zones[i]!.polygone, zones[j]!.polygone),
          false,
          `${zones[i]!.nom} et ${zones[j]!.nom}`,
        );
      }
    }
  });

  it('coupe l’axe le plus étalé', () => {
    // Nuage très large et plat : la coupe doit être verticale, donc les deux
    // secteurs se distinguent en longitude, pas en latitude.
    const plat = Array.from({ length: 20 }, (_, i) => ({
      latitude: 48.85,
      longitude: 2.3 + i * 0.01,
    }));
    const [a, b] = proposerDecoupage(plat, 2);
    assert.ok(a && b);
    const bordA = a.polygone.coordinates[0]!;
    const bordB = b.polygone.coordinates[0]!;
    const estA = Math.max(...bordA.map((p) => p[0]));
    const ouestB = Math.min(...bordB.map((p) => p[0]));
    assert.ok(estA <= ouestB + 1e-9, 'les deux secteurs doivent être côte à côte');
  });

  it('prend ses couleurs dans la palette des zones', () => {
    for (const zone of proposerDecoupage(grille(6), 5)) {
      assert.ok(COULEURS_ZONE.includes(zone.couleur as (typeof COULEURS_ZONE)[number]));
    }
  });

  it('ne réutilise pas un nom de secteur déjà pris', () => {
    const zones = proposerDecoupage(grille(4), 2, ['Secteur 1']);
    assert.equal(zones[0]?.nom, 'Secteur 1 (2)');
    assert.equal(zones[1]?.nom, 'Secteur 2');
  });

  it('ignore les leads sans coordonnées', () => {
    const zones = proposerDecoupage(
      [
        { latitude: null, longitude: null },
        { latitude: 48.85, longitude: 2.39 },
        { latitude: 48.86, longitude: 2.4 },
      ],
      2,
    );
    assert.equal(zones.reduce((n, z) => n + z.nbLeads, 0), 2);
  });

  it('ne propose rien quand aucun lead n’est plaçable', () => {
    assert.deepEqual(proposerDecoupage([{ latitude: null, longitude: null }], 4), []);
    assert.deepEqual(proposerDecoupage([], 4), []);
  });

  it('ne fabrique pas plus de secteurs que de leads', () => {
    const zones = proposerDecoupage([{ latitude: 48.85, longitude: 2.39 }], 4);
    assert.equal(zones.length, 1);
    assert.equal(zones[0]?.nbLeads, 1);
  });
});

describe('fenêtre des trois derniers mois', () => {
  const maintenant = new Date('2026-09-09T12:00:00Z');

  it('garde les leads livrés dans la fenêtre', () => {
    const gardes = depuisTroisMois(
      [
        { deliveredAt: '2026-09-01', createdAt: '2026-09-01T00:00:00Z' },
        { deliveredAt: '2026-07-15', createdAt: '2026-07-15T00:00:00Z' },
        { deliveredAt: '2026-01-10', createdAt: '2026-01-10T00:00:00Z' },
      ],
      maintenant,
    );
    assert.deepEqual(
      gardes.map((l) => l.deliveredAt),
      ['2026-09-01', '2026-07-15'],
    );
  });

  it('retombe sur la date de création sans date de livraison', () => {
    const gardes = depuisTroisMois(
      [{ deliveredAt: null, createdAt: '2026-08-30T00:00:00Z' }],
      maintenant,
    );
    assert.equal(gardes.length, 1);
  });
});
