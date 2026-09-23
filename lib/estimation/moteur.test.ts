import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  actualiserPrixM2,
  ajustementsMoteur,
  arrondirMillier,
  assemblerEstimation,
  construireIndice,
  ecartAbsoluMedian,
  estVenteSimple,
  fourchetteDepuisDispersion,
  haversineM,
  impossible,
  mediane,
  medianePonderee,
  motifDepuisSaisie,
  nettoyerVentes,
  poidsVente,
  prixM2De,
  quantilePondere,
  type LotPondere,
  type MoteurInput,
  type VenteBrute,
} from './moteur';
import { cpsCommune } from './moteur-collecte';

function vente(partial: Partial<VenteBrute> & { id: string }): VenteBrute {
  return {
    idMutation: partial.id,
    dateMutation: '2025-06-01',
    valeurFonciere: 500_000,
    surfaceM2: 70,
    prixM2: 7143,
    typeLocal: 'Appartement',
    natureMutation: 'Vente',
    banId: 'ban-1',
    parcelleId: 'parc-1',
    lat: 48.86,
    lng: 2.4,
    adresse: '12 rue Alphonse Penaud 75020 Paris',
    codePostal: '75020',
    surfaceTerrain: null,
    ...partial,
  };
}

const INPUT: MoteurInput = {
  surfaceM2: 76,
  propertyType: 'appartement',
  floor: '3',
  hasElevator: true,
  dernierEtage: false,
  conditionRating: null,
  dpeClass: null,
  balconTerrasse: false,
  annexes: [],
  terrainM2: null,
};

describe('nettoyage', () => {
  it('garde uniquement une nature Vente', () => {
    assert.equal(estVenteSimple('Vente'), true);
    assert.equal(estVenteSimple(null), true);
    assert.equal(estVenteSimple('Vente en l’état futur d’achèvement'), false);
    assert.equal(estVenteSimple('Echange'), false);
  });

  it('écarte surface ou valeur manquante, et les mutations multi-logements', () => {
    const { candidates, exclues } = nettoyerVentes(
      [
        vente({ id: 'ok', idMutation: 'm1' }),
        vente({ id: 'vide', surfaceM2: null, prixM2: null, valeurFonciere: 400_000 }),
        vente({ id: 'gratuit', valeurFonciere: 0, prixM2: null }),
        vente({ id: 'lot-a', idMutation: 'LOT', valeurFonciere: 1_200_000, surfaceM2: 60, prixM2: 20_000 }),
        vente({ id: 'lot-b', idMutation: 'LOT', valeurFonciere: 1_200_000, surfaceM2: 55, prixM2: 21_000 }),
      ],
      'appartement',
    );
    assert.deepEqual(candidates.map((c) => c.id), ['ok']);
    assert.ok(exclues.some((e) => e.motif === 'sans_surface'));
    assert.ok(exclues.some((e) => e.motif === 'sans_valeur'));
    assert.equal(exclues.filter((e) => e.motif === 'plusieurs_logements').length, 2);
  });

  it('écarte un prix au m² aberrant à plus de 2,5 MAD', () => {
    const proches = [7000, 7100, 7200, 7300, 7400, 7500, 7600].map((pm2, i) =>
      vente({
        id: `n${i}`,
        prixM2: pm2,
        valeurFonciere: pm2 * 70,
        surfaceM2: 70,
      }),
    );
    const { candidates, exclues } = nettoyerVentes(
      [...proches, vente({ id: 'bas', prixM2: 4833, valeurFonciere: 4833 * 70, surfaceM2: 70 })],
      'appartement',
    );
    assert.equal(candidates.some((c) => c.id === 'bas'), false);
    assert.equal(exclues.find((e) => e.id === 'bas')?.motif, 'aberrant_mad');
  });
});

describe('actualisation', () => {
  it('ramène une vente passée à l’indice d’aujourd’hui', () => {
    const indice = construireIndice([
      vente({ id: 'a', dateMutation: '2024-02-01', prixM2: 6000, valeurFonciere: 420_000 }),
      vente({ id: 'b', dateMutation: '2024-03-01', prixM2: 6100, valeurFonciere: 427_000 }),
      vente({ id: 'c', dateMutation: '2024-04-01', prixM2: 6200, valeurFonciere: 434_000 }),
      vente({ id: 'd', dateMutation: '2025-02-01', prixM2: 7000, valeurFonciere: 490_000 }),
      vente({ id: 'e', dateMutation: '2025-03-01', prixM2: 7100, valeurFonciere: 497_000 }),
      vente({ id: 'f', dateMutation: '2025-04-01', prixM2: 7200, valeurFonciere: 504_000 }),
    ]);
    assert.ok(indice);
    const actualise = actualiserPrixM2(6000, '2024-02-15', indice);
    assert.ok(actualise > 6000);
  });
});

describe('pondération', () => {
  it('donne plus de poids à l’immeuble, au récent et à la surface proche', () => {
    const proche = poidsVente({
      distanceM: 20,
      dateIso: new Date().toISOString(),
      surfaceM2: 76,
      surfaceCible: 76,
      sameBuilding: true,
      sameStreet: false,
    });
    const loin = poidsVente({
      distanceM: 900,
      dateIso: '2022-01-01',
      surfaceM2: 140,
      surfaceCible: 76,
      sameBuilding: false,
      sameStreet: false,
    });
    assert.ok(proche > loin);
  });

  it('calcule une médiane pondérée', () => {
    assert.equal(
      medianePonderee([
        { valeur: 4000, poids: 1 },
        { valeur: 7000, poids: 10 },
        { valeur: 12000, poids: 1 },
      ]),
      7000,
    );
    assert.equal(quantilePondere([{ valeur: 10, poids: 1 }, { valeur: 20, poids: 1 }], 0.5), 10);
  });
});

describe('ajustements', () => {
  it('applique le RDC en pourcentage et la cave en euros', () => {
    const lines = ajustementsMoteur(
      {
        ...INPUT,
        floor: 'RDC',
        hasElevator: null,
        annexes: [{ libelle: 'Cave', valorisationEur: null }],
        dpeClass: 'G',
      },
      500_000,
    );
    const rdc = lines.find((l) => l.id === 'rdc');
    const cave = lines.find((l) => l.id === 'annexe_cave');
    const dpe = lines.find((l) => l.id === 'dpe');
    assert.ok(rdc);
    assert.equal(rdc.label, 'Rez-de-chaussée : −6 %');
    assert.equal(rdc.amountEur, Math.round(500_000 * -0.06));
    assert.ok(cave);
    assert.equal(cave.pct, null);
    assert.equal(cave.amountEur, 4_000);
    assert.ok(dpe);
    assert.ok((dpe.pct ?? 0) < 0);
  });
});

describe('assemblage', () => {
  it('n’écrit jamais 0 € et aligne le €/m² sur le prix / surface', () => {
    const lot: LotPondere[] = [6800, 7000, 7200, 7400, 7600].map((pm2, i) => ({
      vente: vente({
        id: `v${i}`,
        prixM2: pm2,
        valeurFonciere: pm2 * 70,
        surfaceM2: 70,
        dateMutation: `2025-0${i + 1}-10`,
      }),
      distanceM: 80 + i * 10,
      sameBuilding: i === 0,
      sameStreet: i === 1,
      prixM2Actualise: pm2,
      poids: 1,
    }));
    const out = assemblerEstimation({
      input: INPUT,
      lot,
      indice: null,
      radiusM: 300,
      fenetreMois: 24,
      exclues: [],
    });
    assert.equal(out.available, true);
    assert.ok(out.value != null && out.value > 0);
    assert.notEqual(out.value, 0);
    assert.equal(out.pricePerM2, Math.round(out.value! / 76));
    assert.ok(out.low != null && out.high != null);
    assert.ok(out.low! < out.value! && out.value! < out.high!);
  });

  it('refuse une saisie incomplète avec une action', () => {
    const m = motifDepuisSaisie({
      surfaceM2: null,
      propertyType: 'appartement',
      latitude: 48.8,
      longitude: 2.3,
      postalCode: '75020',
    });
    assert.equal(m?.code, 'surface_manquante');
    assert.ok(m?.action.includes('main'));
    const zero = impossible('valeur_incalculable', 'x', 'y');
    assert.equal(zero.value, null);
    assert.equal(zero.available, false);
  });
});

describe('commune pour l’indice', () => {
  it('élargit Paris à les 20 arrondissements', () => {
    const cps = cpsCommune('75020');
    assert.equal(cps.length, 20);
    assert.ok(cps.includes('75001') && cps.includes('75020'));
    assert.deepEqual(cpsCommune('74000'), ['74000']);
  });
});

describe('fourchette', () => {
  it('vient de la dispersion, pas d’un ± fixe', () => {
    const f = fourchetteDepuisDispersion(
      [
        { valeur: 400_000, poids: 1 },
        { valeur: 500_000, poids: 2 },
        { valeur: 600_000, poids: 1 },
      ],
      500_000,
    );
    assert.ok(f.low != null && f.low < 500_000);
    assert.ok(f.high != null && f.high > 500_000);
    const plate = fourchetteDepuisDispersion([{ valeur: 500_000, poids: 1 }], 500_000);
    assert.equal(plate.low, null);
    assert.equal(plate.high, null);
  });
});

describe('utilitaires', () => {
  it('médiane, MAD, millier, haversine', () => {
    assert.equal(mediane([1, 2, 3]), 2);
    assert.equal(ecartAbsoluMedian([1, 2, 3]), 1);
    assert.equal(arrondirMillier(546400), 546000);
    assert.equal(arrondirMillier(0), null);
    assert.equal(arrondirMillier(-10), null);
    assert.ok(haversineM(48.86, 2.4, 48.861, 2.401) < 200);
    assert.equal(prixM2De({ prixM2: null, valeurFonciere: 100_000, surfaceM2: 25 }), 4000);
  });
});
