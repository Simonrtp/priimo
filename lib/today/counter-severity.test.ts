import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { FIELD } from '@/lib/today/field';
import {
  formatWeekDelta,
  leadsNonPrisTone,
  mandats60jTone,
  mandatsActifsTone,
  rdvSansSuiteTone,
  toneColor,
} from './counter-severity';

describe('leadsNonPrisTone', () => {
  it('est rouge sous 50 % de prise (107 non pris / 146 livrés)', () => {
    assert.equal(leadsNonPrisTone(107, 146), 'probleme');
  });

  it('est ardoise entre 50 % et 70 %', () => {
    assert.equal(leadsNonPrisTone(40, 100), 'surveiller');
  });

  it('est vert au-dessus de 70 %', () => {
    assert.equal(leadsNonPrisTone(20, 100), 'sain');
  });

  it('est informatif si rien n’est livré', () => {
    assert.equal(leadsNonPrisTone(0, 0), 'info');
  });
});

describe('toneColor', () => {
  it('met le zéro en gris même si le ton est un problème', () => {
    assert.equal(toneColor('probleme', 0), '#94A3B8');
  });

  it('n’utilise jamais l’orange', () => {
    assert.notEqual(toneColor('sain', 3), FIELD.orange);
    assert.notEqual(toneColor('surveiller', 3), FIELD.orange);
    assert.notEqual(toneColor('probleme', 3), FIELD.orange);
  });
});

describe('autres tons', () => {
  it('traite un stock de mandats comme sain', () => {
    assert.equal(mandatsActifsTone(4), 'sain');
    assert.equal(mandatsActifsTone(0), 'info');
  });

  it('signale les mandats qui pourrissent en problème', () => {
    assert.equal(mandats60jTone(2), 'probleme');
    assert.equal(rdvSansSuiteTone(1), 'surveiller');
  });
});

describe('formatWeekDelta', () => {
  it('reste muet sans historique', () => {
    assert.equal(formatWeekDelta(12, null), null);
  });

  it('écrit la variation', () => {
    assert.equal(formatWeekDelta(12, 10), '+2 vs semaine dernière');
    assert.equal(formatWeekDelta(8, 10), '-2 vs semaine dernière');
    assert.equal(formatWeekDelta(10, 10), 'comme la semaine dernière');
  });
});
