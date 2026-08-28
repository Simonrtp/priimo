import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { REFORMULER_SYSTEM_PROMPT, REFORMULER_TIMEOUT_MS } from './repondre';

describe('consigne de reformulation', () => {
  it('contient la consigne mot pour mot', () => {
    assert.match(REFORMULER_SYSTEM_PROMPT, /Tu n'ajoutes aucune information absente des données fournies/);
    assert.match(REFORMULER_SYSTEM_PROMPT, /tu ne suggères aucune action/);
    assert.equal(REFORMULER_TIMEOUT_MS, 8000);
  });

  it('interdit de citer ce qui n’est pas dans les lignes', () => {
    assert.match(
      REFORMULER_SYSTEM_PROMPT,
      /Tu ne cites aucune personne, adresse ou téléphone absent des lignes/,
    );
  });

  it('ne contient rien de variable : le préfixe doit rester identique', () => {
    assert.doesNotMatch(REFORMULER_SYSTEM_PROMPT, /\$\{|\d{4}-\d{2}-\d{2}/);
  });
});
