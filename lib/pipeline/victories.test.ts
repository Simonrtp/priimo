import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { pipelineVictoryKind } from './victories';

describe('pipelineVictoryKind', () => {
  const pris = { id: 'p', cle: 'pris', type: 'entree' as const };
  const contacte = { id: 'a', cle: 'contacte', type: 'intermediaire' as const };
  const rdv = { id: 'b', cle: 'rendez_vous', type: 'intermediaire' as const };
  const estimation = { id: 'e', cle: 'estimation', type: 'intermediaire' as const };
  const mandat = { id: 'c', cle: 'mandat', type: 'gagne' as const };
  const vendu = { id: 'v', cle: 'vendu', type: 'gagne' as const };

  it('célèbre un passage à Contacté (compteur Accueil)', () => {
    assert.equal(pipelineVictoryKind(pris, contacte), 'contacte');
  });

  it('célèbre un rendez-vous', () => {
    assert.equal(pipelineVictoryKind(contacte, rdv), 'rendez_vous');
  });

  it('célèbre une estimation (compteur Accueil)', () => {
    assert.equal(pipelineVictoryKind(rdv, estimation), 'estimation');
  });

  it('célèbre un mandat signé', () => {
    assert.equal(pipelineVictoryKind(estimation, mandat), 'mandat');
  });

  it('célèbre un vendu sans le confondre avec un mandat', () => {
    assert.equal(pipelineVictoryKind(mandat, vendu), 'vendu');
  });

  it('ignore un réordonnancement dans la même colonne', () => {
    assert.equal(pipelineVictoryKind(rdv, rdv), null);
    assert.equal(pipelineVictoryKind(null, contacte), null);
  });
});
