import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { estQuestionDictee } from './question-dictee';

describe('estQuestionDictee', () => {
  it('reconnaît une question posée à Mon assistant', () => {
    for (const q of [
      'Qui sont les contacts qui veulent... Accéder à un bien.',
      'Quels sont mes acquéreurs dans le 11e ?',
      "Est-ce qu'on a quelqu'un qui cherche un T3 ?",
      'Combien de biens on a en exclusivité',
      'Alors, qui veut vendre rue Vitruve ?',
      'Euh mon assistant, quelles maisons on a à moins de 500 000 euros',
      'Le numéro de Sophie Dubois ?',
      'Tu as le téléphone de Martin ?',
      'Donne-moi les vendeurs du 75020.',
      'Où en est le dossier Durand ?',
      'J’ai combien d’acquéreurs ?',
    ]) {
      assert.equal(estQuestionDictee(q), true, q);
    }
  });

  it('laisse les notes en notes', () => {
    for (const n of [
      'Rencontré Mme Dupont au 12 rue Vitruve, elle veut vendre son T3.',
      "Rappelle-moi d'appeler Martin jeudi.",
      "Quand je suis passé chez M. Durand, il m'a dit qu'il voulait vendre.",
      'Mme Dupont m’a demandé si on pouvait passer jeudi ?',
      'Ou alors on repasse demain matin.',
      'Quiche offerte par la gardienne, très sympa, elle connaît tout le monde.',
      '',
      'Qui ?',
    ]) {
      assert.equal(estQuestionDictee(n), false, n);
    }
  });

  it('une longue dictée reste une note, même ouverte par « qui »', () => {
    const longue = `Qui l'eût cru : ${'la propriétaire du troisième veut vendre, '.repeat(10)}`;
    assert.equal(estQuestionDictee(longue), false);
  });
});
