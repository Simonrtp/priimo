import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  hoverPreviewFromCadastre,
  hoverPreviewFromPoint,
} from './hover-preview';
import type { MapPoint } from './points';
import type { CadastreImmeublePoint } from './parcelle';

function point(partial: Partial<MapPoint> & Pick<MapPoint, 'kind' | 'title'>): MapPoint {
  return {
    id: 'x',
    recordId: 'x',
    banId: 'ban',
    latitude: 48.85,
    longitude: 2.35,
    postalCode: '75020',
    subtitle: '',
    href: '/',
    color: '#E8743C',
    badge: '·',
    assignedTo: null,
    occurredAt: '2026-08-01T00:00:00.000Z',
    ...partial,
  };
}

const immeuble: CadastreImmeublePoint = {
  banId: '75120_5985_00010',
  parcelleId: '75120000EC0003',
  longitude: 2.41,
  latitude: 48.85,
  adresse: '10 rue des Maraîchers',
  etiquetteDpe: 'E',
  nbDpe: 28,
  nbPassoires: 3,
  nbTransactions: 15,
  dernierPrix: 509100,
  prixM2: 9152,
  nbLots: 20,
  procedureCopro: false,
};

describe('hoverPreviewFromPoint', () => {
  it('montre le score et le signal d’un prospect', () => {
    const preview = hoverPreviewFromPoint(
      point({
        kind: 'lead',
        title: '10 rue des Maraîchers',
        subtitle: 'DPE récent · Appartement · 62 m²',
        score: 78,
      }),
    );
    assert.equal(preview.kindLabel, 'Prospect');
    assert.equal(preview.title, '10 rue des Maraîchers');
    assert.equal(preview.lines[0], '78 / 100');
    assert.ok(preview.lines.includes('DPE récent'));
  });

  it('montre nom, téléphone et type d’un contact', () => {
    const preview = hoverPreviewFromPoint(
      point({
        kind: 'contact',
        title: 'Marie Curie',
        subtitle: 'Vendeur · 75020',
        phone: '06 01 02 03 04',
      }),
    );
    assert.equal(preview.kindLabel, 'Contact');
    assert.equal(preview.title, 'Marie Curie');
    assert.ok(preview.lines.includes('06 01 02 03 04'));
    assert.ok(preview.lines.includes('Vendeur'));
  });

  it('montre l’adresse et le prix d’un bien', () => {
    const preview = hoverPreviewFromPoint(
      point({
        kind: 'bien',
        title: '12 rue des Pyrénées',
        subtitle: 'Mandat simple · Appartement · 420 000 €',
      }),
    );
    assert.equal(preview.kindLabel, 'Bien');
    assert.ok(preview.lines.some((l) => l.includes('420 000 €')));
  });

  it('signale plusieurs fiches au même point', () => {
    const preview = hoverPreviewFromPoint(
      point({ kind: 'lead', title: 'Adresse', score: 50, subtitle: 'Signal' }),
      3,
    );
    assert.ok(preview.lines.includes('3 fiches à cette adresse'));
  });
});

describe('hoverPreviewFromCadastre', () => {
  it('montre la lettre DPE et le nombre de diagnostics', () => {
    const preview = hoverPreviewFromCadastre(immeuble, 'dpe');
    assert.equal(preview.kindLabel, 'DPE');
    assert.equal(preview.title, 'Classe E');
    assert.equal(preview.letter, 'E');
    assert.ok(preview.lines.includes('10 rue des Maraîchers'));
    assert.ok(preview.lines.includes('28 diagnostics'));
  });

  it('montre le dernier prix et le nombre de ventes', () => {
    const preview = hoverPreviewFromCadastre(immeuble, 'ventes');
    assert.equal(preview.kindLabel, 'Vente');
    assert.equal(preview.title, '509 100 €');
    assert.ok(preview.lines.includes('15 ventes'));
  });

  it('montre les lots et une procédure copro', () => {
    const preview = hoverPreviewFromCadastre(
      { ...immeuble, procedureCopro: true },
      'copro',
    );
    assert.equal(preview.kindLabel, 'Copropriété');
    assert.equal(preview.title, '20 lots');
    assert.ok(preview.lines.includes('Procédure en cours'));
  });
});
