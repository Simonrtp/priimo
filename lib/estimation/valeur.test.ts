import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { appliquerQualiteEtAgent, capitaliser } from './valeur';
import type { CorrectionLine } from './corrections';

const BASE: CorrectionLine[] = [
  { id: 'base', label: 'Base', amountEur: 400_000, sampleSize: 12, kind: 'base' },
  { id: 'total', label: 'Total', amountEur: 400_000, sampleSize: null, kind: 'total' },
];

const AGENT_ZERO = {
  travauxEur: 0,
  decoteOccupationEur: 0,
  autresEur: 0,
  justification: null,
};

describe('valeur d’estimation', () => {
  it('ne fabrique pas 0 € à partir d’un détail vide', () => {
    assert.equal(
      appliquerQualiteEtAgent([], {
        grille: {},
        agent: AGENT_ZERO,
        honorairesPct: 5,
        netVendeur: false,
        rangePct: 0.08,
      }),
      null,
    );
  });

  it('n’invente pas de capitalisation si le bien est libre', () => {
    assert.equal(
      capitaliser({ occupation: 'libre', loyerAnnuel: 12_000, honorairesPct: 5, netVendeur: false }),
      null,
    );
  });

  it('capitalise seulement un bien occupé avec loyer', () => {
    const cap = capitaliser({
      occupation: 'occupe',
      loyerAnnuel: 12_000,
      honorairesPct: 5,
      netVendeur: true,
    });
    assert.ok(cap);
    assert.equal(cap.methode, 'capitalisation');
    assert.ok(cap.valeur > 12_000);
    assert.ok(cap.netVendeur < cap.valeur);
  });

  it('déduit les honoraires en net vendeur', () => {
    const out = appliquerQualiteEtAgent(BASE, {
      grille: {},
      agent: AGENT_ZERO,
      honorairesPct: 5,
      netVendeur: true,
      rangePct: 0.08,
    });
    assert.ok(out);
    assert.equal(out.valeur, 400_000);
    assert.equal(out.netVendeur, 380_000);
  });

  it('ajoute une ligne qualité seulement si la grille dit quelque chose', () => {
    const vide = appliquerQualiteEtAgent(BASE, {
      grille: {},
      agent: AGENT_ZERO,
      honorairesPct: 5,
      netVendeur: false,
      rangePct: 0.08,
    });
    assert.ok(vide);
    assert.equal(vide.lignes.some((l) => l.id === 'qualite'), false);

    const pleine = appliquerQualiteEtAgent(BASE, {
      grille: { standing: { valeur: 5, source: 'agent' } },
      agent: AGENT_ZERO,
      honorairesPct: 5,
      netVendeur: false,
      rangePct: 0.08,
    });
    assert.ok(pleine);
    assert.equal(pleine.lignes.some((l) => l.id === 'qualite'), true);
  });
});
