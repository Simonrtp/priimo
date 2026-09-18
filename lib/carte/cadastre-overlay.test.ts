import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatPrixM2Court, hasCadastreOverlay, dpeVisibleOnMap, mergeCadastreImmeubles } from './cadastre-overlay';
import type { OverlayActivity, OverlayBuilding, OverlayDpeRow } from './cadastre-overlay';

const building: OverlayBuilding = {
  banId: 'ban-1',
  parcelleId: '75120000EC0003',
  longitude: 2.41,
  latitude: 48.85,
  adresse: '10 rue des Maraîchers',
};

const activity: OverlayActivity = {
  banId: 'ban-1',
  nbTransactions: 15,
  derniereTransactionLe: '2024-03-12',
  prixM2: 9200,
  dernierPrix: 509100,
  nbDpe: 28,
  dernierDpeLe: '2024-01-01',
  etiquetteDpe: 'E',
  nbPassoires: 3,
  nbLots: 20,
  procedureCopro: false,
};

describe('mergeCadastreImmeubles', () => {
  const now = new Date('2026-09-15T12:00:00.000Z');

  it('pose un point par adresse pour un DPE de moins de 6 mois', () => {
    const frais: OverlayDpeRow = {
      banId: 'ban-1',
      dateDpe: '2026-09-15',
      etiquetteDpe: 'C',
      surface: 62,
      etage: 3,
    };
    const [point] = mergeCadastreImmeubles({
      buildings: [building],
      activity: [activity],
      dpeRows: [frais],
      ages: ['semaine', '1-3'],
      now,
    });
    assert.equal(point.dpeGrain, 'adresse');
    assert.equal(point.etiquetteDpe, 'C');
    assert.equal(point.surfaceDpe, 62);
    assert.equal(point.etageDpe, 3);
    assert.equal(point.dateDpe, '2026-09-15');
  });

  it('garde l’agrégat au-delà de 6 mois', () => {
    const [point] = mergeCadastreImmeubles({
      buildings: [building],
      activity: [activity],
      dpeRows: [],
      ages: ['1-3'],
      now,
    });
    assert.equal(point.dpeGrain, 'immeuble');
    assert.equal(point.etiquetteDpe, 'E');
    assert.equal(point.dateDpe, '2024-01-01');
    assert.equal(point.surfaceDpe, null);
  });

  it('n’affiche pas un DPE hors cases cochées', () => {
    const [point] = mergeCadastreImmeubles({
      buildings: [building],
      activity: [activity],
      dpeRows: [
        {
          banId: 'ban-1',
          dateDpe: '2026-09-15',
          etiquetteDpe: 'A',
          surface: 40,
          etage: 1,
        },
      ],
      ages: ['3+'],
      now,
    });
    assert.equal(point.dpeGrain, null);
    assert.equal(point.etiquetteDpe, null);
  });

  it('n’affiche pas un DPE de 2025 si le curseur est sur cette semaine', () => {
    const [point] = mergeCadastreImmeubles({
      buildings: [building],
      activity: [{ ...activity, etiquetteDpe: 'B', dernierDpeLe: '2025-07-22' }],
      dpeRows: [
        {
          banId: 'ban-1',
          dateDpe: '2025-07-22',
          etiquetteDpe: 'B',
          surface: 55,
          etage: null,
        },
      ],
      ages: ['semaine'],
      now,
    });
    assert.equal(point.dpeGrain, null);
    assert.equal(point.etiquetteDpe, null);
  });

  it('agrège un DPE de 6 à 12 mois hors building_activity', () => {
    const [point] = mergeCadastreImmeubles({
      buildings: [building],
      activity: [{ ...activity, etiquetteDpe: null, dernierDpeLe: null }],
      dpeRows: [
        {
          banId: 'ban-1',
          dateDpe: '2026-01-15',
          etiquetteDpe: 'D',
          surface: 48,
          etage: null,
        },
      ],
      ages: ['6-12'],
      now,
    });
    assert.equal(point.dpeGrain, 'immeuble');
    assert.equal(point.etiquetteDpe, 'D');
    assert.equal(point.etageDpe, null);
  });
});

describe('formatPrixM2Court', () => {
  it('écrit le format court demandé sur la carte', () => {
    assert.equal(formatPrixM2Court(9200), '9 200 €/m²');
    assert.equal(formatPrixM2Court(null), null);
  });
});

describe('hasCadastreOverlay', () => {
  it('garde un DPE sans vente ni copro', () => {
    assert.equal(
      hasCadastreOverlay({
        dpeGrain: 'adresse',
        etiquetteDpe: 'C',
        nbTransactions: 0,
        nbLots: null,
        procedureCopro: false,
      }),
      true,
    );
  });

  it('ignore un immeuble sans couche cadastre', () => {
    assert.equal(
      hasCadastreOverlay({
        dpeGrain: null,
        etiquetteDpe: null,
        nbTransactions: 0,
        nbLots: null,
        procedureCopro: false,
      }),
      false,
    );
  });
});

describe('dpeVisibleOnMap', () => {
  const now = new Date('2026-09-18T12:00:00.000Z');

  it('masque un DPE hors de la plage du curseur', () => {
    assert.equal(
      dpeVisibleOnMap(
        { dpeGrain: 'adresse', etiquetteDpe: 'B', dateDpe: '2025-07-22' },
        ['semaine'],
        now,
      ),
      false,
    );
  });

  it('garde un DPE de la semaine demandée', () => {
    assert.equal(
      dpeVisibleOnMap(
        { dpeGrain: 'adresse', etiquetteDpe: 'B', dateDpe: '2026-09-16' },
        ['semaine'],
        now,
      ),
      true,
    );
  });
});
