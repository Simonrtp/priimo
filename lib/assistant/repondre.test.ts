import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { REFORMULER_SYSTEM_PROMPT, REFORMULER_TIMEOUT_MS, reformulerLignes } from './repondre';
import type { CollecteResult } from './collecte';

const collecte: CollecteResult = {
  type: 'immeuble',
  cherche: '27 rue Alphonse Penaud',
  banId: 'ban-1',
  rechercheParTexte: false,
  agregats: null,
  lignes: [
    {
      kind: 'contact',
      id: 'ct-1',
      date: '2026-04-01T10:00:00.000Z',
      auteur: null,
      faits: { nom: 'Marie Martin', type: 'vendeur', telephone: '0600000000' },
    },
  ],
  sources: [],
};

describe('reformulerLignes', () => {
  it('contient la consigne mot pour mot', () => {
    assert.match(REFORMULER_SYSTEM_PROMPT, /Tu n'ajoutes aucune information absente des données fournies/);
    assert.match(REFORMULER_SYSTEM_PROMPT, /tu ne suggères aucune action/);
    assert.equal(REFORMULER_TIMEOUT_MS, 8000);
  });

  it('rend les données brutes si l’appel échoue ou est abandonné', async () => {
    const fetchImpl = (async () => {
      throw Object.assign(new Error('Aborted'), { name: 'AbortError' });
    }) as typeof fetch;

    const out = await reformulerLignes("Qu'est-ce qu'on sait du 27 ?", collecte, 'key', fetchImpl);
    assert.equal(out.brut, true);
    assert.match(out.texte, /Marie Martin/);
  });
});
