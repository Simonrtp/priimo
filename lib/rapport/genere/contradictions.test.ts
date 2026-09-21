import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { contradictionsCommentaire } from './contradictions';

describe('contradictions commentaire / champs', () => {
  it('signale un ascenseur cité contre le champ sans ascenseur', () => {
    const out = contradictionsCommentaire({
      commentaire: 'Bel appartement avec ascenseur et cave.',
      ascenseur: false,
      floor: '3',
      surfaceM2: 52,
      dpeClass: 'D',
    });
    assert.equal(out.some((c) => c.id === 'ascenseur'), true);
  });

  it('ne signale rien si le texte et les champs s’accordent', () => {
    const out = contradictionsCommentaire({
      commentaire: 'Appartement de 52 m² au 3e étage, DPE D, sans ascenseur.',
      ascenseur: false,
      floor: '3',
      surfaceM2: 52,
      dpeClass: 'D',
    });
    assert.deepEqual(out, []);
  });

  it('détecte un DPE différent', () => {
    const out = contradictionsCommentaire({
      commentaire: 'DPE C récemment réalisé.',
      ascenseur: null,
      floor: null,
      surfaceM2: null,
      dpeClass: 'E',
    });
    assert.equal(out.some((c) => c.id === 'dpe'), true);
  });
});
