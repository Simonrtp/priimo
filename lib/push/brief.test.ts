import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { construireBrief, type MatiereBrief } from './brief';

function matiere(over: Partial<MatiereBrief> = {}): MatiereBrief {
  return {
    prenom: 'Simon',
    actionsOuvertes: 0,
    meilleureAction: null,
    rendezVous: 0,
    promessesDues: 0,
    ...over,
  };
}

describe('construireBrief', () => {
  it('se tait quand la journée n’a rien à annoncer', () => {
    assert.equal(construireBrief(matiere()), null);
  });

  it('annonce un seul élément sans énumération', () => {
    const brief = construireBrief(matiere({ rendezVous: 2 }));
    assert.equal(brief?.titre, 'Bonjour Simon — 2 rendez-vous');
  });

  it('énumère proprement en français', () => {
    const brief = construireBrief(
      matiere({ rendezVous: 1, promessesDues: 2, actionsOuvertes: 3 }),
    );
    assert.equal(
      brief?.titre,
      'Bonjour Simon — 1 rendez-vous, 2 promesses et 3 actions à valider',
    );
  });

  it('accorde le singulier', () => {
    const brief = construireBrief(matiere({ promessesDues: 1, actionsOuvertes: 1 }));
    assert.match(String(brief?.titre), /1 promesse et 1 action à valider/);
  });

  it('reste correct sans prénom connu', () => {
    const brief = construireBrief(matiere({ prenom: null, rendezVous: 1 }));
    assert.match(String(brief?.titre), /^Bonjour — /);
  });

  it('met la meilleure proposition dans le corps', () => {
    const brief = construireBrief(
      matiere({ actionsOuvertes: 2, meilleureAction: '3 acquéreurs pour le 12 rue de la Paix' }),
    );
    assert.equal(brief?.corps, '3 acquéreurs pour le 12 rue de la Paix');
  });

  it('mène vers la boîte à valider quand il y a des propositions', () => {
    const avec = construireBrief(matiere({ actionsOuvertes: 1 }));
    const sans = construireBrief(matiere({ rendezVous: 1 }));
    assert.equal(avec?.url, '/dashboard/actions');
    assert.equal(sans?.url, '/dashboard');
  });
});
