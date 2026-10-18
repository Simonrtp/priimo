import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { drapeauxPhase, type PhaseTournee } from './phases';

const PHASES: readonly PhaseTournee[] = ['off', 'preparation', 'brief', 'route', 'pause', 'bilan'];

describe('phases de tournée', () => {
  it('décrit chaque phase', () => {
    for (const phase of PHASES) {
      const d = drapeauxPhase(phase);
      assert.equal(typeof d.trace, 'boolean');
      assert.equal(typeof d.immersion, 'boolean');
      assert.equal(typeof d.chrome, 'boolean');
      assert.equal(typeof d.suivi, 'boolean');
      assert.equal(typeof d.occupe, 'boolean');
    }
  });

  it('en pause, la carte redevient normale et le tracé reste', () => {
    const pause = drapeauxPhase('pause');
    assert.equal(pause.trace, true);
    assert.equal(pause.immersion, false);
    assert.equal(pause.chrome, true);
    assert.equal(pause.suivi, false);
    assert.equal(pause.occupe, false);
  });

  it('en marche, la carte s’efface derrière le tracé', () => {
    for (const phase of ['brief', 'route'] as const) {
      const d = drapeauxPhase(phase);
      assert.equal(d.trace, true);
      assert.equal(d.immersion, true);
      assert.equal(d.chrome, false);
      assert.equal(d.suivi, true);
      assert.equal(d.occupe, true);
    }
  });

  it('le bilan garde le tracé sans compter la marche', () => {
    const bilan = drapeauxPhase('bilan');
    assert.equal(bilan.trace, true);
    assert.equal(bilan.suivi, false);
    assert.equal(bilan.chrome, false);
    assert.equal(bilan.occupe, true);
  });
});
