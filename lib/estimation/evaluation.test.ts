import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { evaluerEchantillon, seuilsTenus, synthetiser, type EchantillonEvaluation } from './evaluation';
import { actualiserPrixM2, ajustementsMoteur } from './moteur';
import { MOTEUR_CONFIG } from './moteur-config';
import { formaterAdresseComparable, rueSeule } from './adresse-comparable';
import { secteurEstimeCouvert } from './departements-couverts';

function nuage(zone: string, cp: string, type: 'appartement' | 'maison', lat: number, lng: number, n: number): EchantillonEvaluation[] {
  const out: EchantillonEvaluation[] = [];
  const base = type === 'maison' ? 5200 : 7800;
  for (let i = 0; i < n; i++) {
    const surface = type === 'maison' ? 110 + (i % 8) * 5 : 55 + (i % 10) * 3;
    const bruit = 1 + ((i % 7) - 3) * 0.02;
    out.push({
      id: `${zone}-${type}-${i}`,
      zone,
      type,
      surfaceM2: surface,
      prix: Math.round(base * surface * bruit),
      date: `2025-0${(i % 9) + 1}-15`,
      lat: lat + (i % 5) * 0.001,
      lng: lng + (i % 4) * 0.001,
      postalCode: cp,
    });
  }
  return out;
}

describe('évaluation leave-one-out (échantillon synthétique)', () => {
  it('reste dans les seuils proposés sur un nuage homogène', () => {
    const echantillon = [
      ...nuage('Paris 20e', '75020', 'appartement', 48.865, 2.398, 24),
      ...nuage('Annecy', '74000', 'appartement', 45.9, 6.12, 18),
    ];
    const lignes = evaluerEchantillon(echantillon);
    const rapport = synthetiser(lignes);
    assert.ok(rapport.nEstimes >= 30, `estimés ${rapport.nEstimes}`);
    assert.ok(seuilsTenus(rapport), JSON.stringify(rapport));
  });
});

describe('actualisation plafonnée', () => {
  it('ne décale pas une vente de plus que INDEX_CAP', () => {
    const indice = {
      niveau: 'code_postal' as const,
      actuel: 8000,
      trimestres: [
        { cle: '2022-1', mediane: 5000, n: 12 },
        { cle: '2024-4', mediane: 8000, n: 12 },
      ],
    };
    const out = actualiserPrixM2(5000, '2022-02-01', indice);
    const max = 5000 * (1 + MOTEUR_CONFIG.INDEX_CAP);
    assert.ok(out <= max + 1);
  });
});

describe('ajustements visibles', () => {
  it('affiche piscine, terrain, DPE et laisse l’agent surcharger', () => {
    const base = 500_000;
    const lignes = ajustementsMoteur(
      {
        surfaceM2: 120,
        propertyType: 'maison',
        floor: null,
        hasElevator: null,
        dernierEtage: null,
        conditionRating: 2,
        dpeClass: 'F',
        balconTerrasse: false,
        piscine: true,
        annexes: [],
        terrainM2: 400,
        ajustementsAgent: { piscine: 0.02 },
      },
      base,
    );
    assert.ok(lignes.some((l) => l.id === 'piscine' && l.pct === 0.02));
    assert.ok(lignes.some((l) => l.id === 'terrain'));
    assert.ok(lignes.some((l) => l.id === 'dpe'));
    assert.ok(lignes.some((l) => l.id === 'etat'));
  });
});

describe('adresses comparables', () => {
  it('garde l’adresse complète tant que la constante est full', () => {
    const a = '12 rue Alphonse Penaud 75020 Paris';
    assert.equal(formaterAdresseComparable(a), a);
    assert.equal(rueSeule(a), 'rue Alphonse Penaud');
  });
});

describe('couverture', () => {
  it('ouvre 75, 74, 64 et refuse le reste', () => {
    assert.equal(secteurEstimeCouvert('75020'), true);
    assert.equal(secteurEstimeCouvert('74000'), true);
    assert.equal(secteurEstimeCouvert('64200'), true);
    assert.equal(secteurEstimeCouvert('33000'), false);
  });
});
