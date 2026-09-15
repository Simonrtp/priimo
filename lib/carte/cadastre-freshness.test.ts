import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  formatCadastreFreshness,
  formatDiagnosticsAJour,
  formatVentesSemestre,
} from './cadastre-freshness';

describe('fraîcheur cadastre', () => {
  const now = new Date('2026-09-15T12:00:00.000Z');

  it('date le dernier import ADEME au jour', () => {
    assert.equal(formatDiagnosticsAJour('2026-09-15T06:00:00.000Z', now), 'Diagnostics à jour au 15 septembre');
  });

  it('date les ventes au semestre du fichier DVF', () => {
    assert.equal(formatVentesSemestre('2026-07-01'), 'Ventes au 2e semestre 2026');
    assert.equal(formatVentesSemestre('2026-03-12'), 'Ventes au 1er semestre 2026');
  });

  it('assemble la ligne du menu', () => {
    assert.equal(
      formatCadastreFreshness(
        { diagnosticsAt: '2026-09-15', ventesAt: '2026-07-01' },
        now,
      ),
      'Diagnostics à jour au 15 septembre · Ventes au 2e semestre 2026',
    );
    assert.equal(formatCadastreFreshness({ diagnosticsAt: null, ventesAt: null }, now), null);
  });
});
