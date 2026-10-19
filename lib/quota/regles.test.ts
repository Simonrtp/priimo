import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PLAFONDS_IA_JOUR } from '@/lib/ia/quota-regles';
import { plafondsIa, plafondsLecturePage } from './regles';

describe('plafonds du jour', () => {
  it('Bright Data : 30 / 100 / 300 par défaut, réglables par variable d’environnement', () => {
    assert.deepEqual(plafondsLecturePage(), { agent: 30, agence: 100, global: 300 });
    process.env.BRIGHTDATA_PLAFOND_GLOBAL_JOUR = '50';
    process.env.BRIGHTDATA_PLAFOND_AGENT_JOUR = 'n’importe quoi';
    try {
      assert.deepEqual(plafondsLecturePage(), { agent: 30, agence: 100, global: 50 });
    } finally {
      delete process.env.BRIGHTDATA_PLAFOND_GLOBAL_JOUR;
      delete process.env.BRIGHTDATA_PLAFOND_AGENT_JOUR;
    }
  });

  it('IA : l’agence a droit à quatre agents pleins, tout Priimo à vingt-cinq', () => {
    const agent = PLAFONDS_IA_JOUR.assistant;
    assert.deepEqual(plafondsIa('assistant'), { agent, agence: agent * 4, global: agent * 25 });
  });
});
