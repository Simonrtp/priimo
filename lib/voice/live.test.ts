import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  LIVE_FIRST_FLUSH_ESTIMATION_MS,
  LIVE_FIRST_FLUSH_MS,
  prochainDelaiLive,
} from './live';

/** Secondes d'audio envoyées au total : chaque passe renvoie tout depuis le début. */
function audioTranscrit(dureeMs: number, estimation: boolean): number {
  let t = estimation ? LIVE_FIRST_FLUSH_ESTIMATION_MS : LIVE_FIRST_FLUSH_MS;
  let total = 0;
  while (t < dureeMs) {
    total += t;
    t += prochainDelaiLive(t, estimation);
  }
  return total / 1000;
}

describe('prochainDelaiLive', () => {
  it('garde une note de trois minutes sous quatre fois sa durée', () => {
    assert.ok(audioTranscrit(180_000, false) < 4 * 180);
  });

  it('garde une note de dix minutes sous quatre fois sa durée', () => {
    assert.ok(audioTranscrit(600_000, false) < 4 * 600);
  });

  it('reste vif au début d’une dictée d’estimation', () => {
    assert.equal(prochainDelaiLive(3_000, true), 1_500);
  });

  it('borne une dictée d’estimation d’une minute', () => {
    assert.ok(audioTranscrit(60_000, true) < 6 * 60);
  });
});
