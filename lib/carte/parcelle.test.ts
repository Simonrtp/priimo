import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  centroidLngLat,
  filterPublicDiagnostics,
  formatIdu,
  isPublicDpeTooRecent,
  normalizeIdu,
} from './parcelle';

describe('normalizeIdu', () => {
  it('accepte un idu PCI 14 caractères', () => {
    assert.equal(normalizeIdu('75104000ad0035'), '75104000AD0035');
  });

  it('refuse un idu trop court ou sale', () => {
    assert.equal(normalizeIdu('123'), null);
    assert.equal(normalizeIdu('idu;drop'), null);
    assert.equal(normalizeIdu(''), null);
  });
});

describe('formatIdu', () => {
  it('aère la référence 14 caractères', () => {
    assert.equal(formatIdu('75104000AD0035'), '75104 000 AD 0035');
  });
});

describe('DPE fraîcheur publique', () => {
  const now = new Date('2026-08-25T12:00:00.000Z');

  it('écarte un DPE de moins de 12 mois', () => {
    assert.equal(isPublicDpeTooRecent('2026-02-01', now), true);
    assert.equal(isPublicDpeTooRecent('2025-08-26', now), true);
  });

  it('garde un DPE d’au moins 12 mois', () => {
    assert.equal(isPublicDpeTooRecent('2025-08-25', now), false);
    assert.equal(isPublicDpeTooRecent('2024-01-01', now), false);
  });

  it('filtre la liste côté serveur sans toucher aux autres diagnostics', () => {
    const kept = filterPublicDiagnostics(
      [
        { date: '2026-03-01', etiquette: 'D', type: 'DPE' },
        { date: '2024-03-01', etiquette: 'E', type: 'DPE' },
        { date: '2026-01-01', etiquette: null, type: 'amiante' },
      ],
      now,
    );
    assert.deepEqual(
      kept.map((r) => r.type),
      ['DPE', 'amiante'],
    );
    assert.equal(kept[0]?.etiquette, 'E');
  });
});

describe('centroidLngLat', () => {
  it('moyenne le premier anneau d’un MultiPolygon', () => {
    const c = centroidLngLat({
      type: 'MultiPolygon',
      coordinates: [
        [
          [
            [3, 50],
            [5, 50],
            [5, 52],
            [3, 52],
            [3, 50],
          ],
        ],
      ],
    });
    assert.ok(c);
    assert.equal(c.longitude, 3.8);
    assert.equal(c.latitude, 50.8);
  });
});
