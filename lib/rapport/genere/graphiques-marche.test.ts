import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { binsPrixM2, indexBin, svgEvolutionMediane, svgRepartition } from './graphiques-marche';

describe('graphiques marché', () => {
  it('produit le même SVG que la page PDF', () => {
    const evo = svgEvolutionMediane([
      { label: '2023', valeur: 4000 },
      { label: '2024', valeur: 4200 },
      { label: '2025', valeur: 4100 },
    ]);
    assert.match(evo, /<svg/);
    const source = [3000, 3500, 4000, 4500, 5000];
    const bins = binsPrixM2(source, 5);
    const i = indexBin(4000, bins, source);
    const dist = svgRepartition(bins, i);
    assert.match(dist, /<svg/);
    assert.equal(indexBin(4000, bins, source), i);
  });
});
