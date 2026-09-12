import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CRITERES_TOTAL,
  axesRadar,
  criteresRenseignes,
  estimationPeuFiable,
  grilleVide,
  indiceQualitePct,
  fusionnerGrille,
  noteDepuisComptage,
  preremplirDepuisDpe,
  preremplirDepuisPublic,
  scoreFamille,
} from './grille';

describe('grille de caractéristiques', () => {
  it('compte 34 critères et démarre vide — pas sur Moyen', () => {
    assert.equal(CRITERES_TOTAL, 34);
    const vide = grilleVide();
    assert.equal(criteresRenseignes(vide), 0);
    assert.equal(scoreFamille(vide, 'sejour'), null);
    assert.equal(indiceQualitePct(vide), null);
  });

  it('laisse un trou radar sur une famille jamais touchée', () => {
    const grille = { standing: { valeur: 5 as const, source: 'agent' as const } };
    const axes = axesRadar(grille);
    const principaux = axes.find((a) => a.famille === 'elements_principaux');
    const cuisine = axes.find((a) => a.famille === 'cuisine');
    assert.ok(principaux && principaux.score != null);
    assert.equal(cuisine?.score, null);
  });

  it('plafonne l’indice de qualité à ±10 %', () => {
    const parfait: Record<string, { valeur: 5; source: 'agent' }> = {};
    for (const id of [
      'standing',
      'etat_general',
      'luminosite',
      'vue',
      'calme',
    ]) {
      parfait[id] = { valeur: 5, source: 'agent' };
    }
    assert.ok((indiceQualitePct(parfait) ?? 0) <= 0.1);
    assert.ok((indiceQualitePct(parfait) ?? 0) > 0);

    const mauvais = { standing: { valeur: 1 as const, source: 'agent' as const } };
    assert.ok((indiceQualitePct(mauvais) ?? 0) >= -0.1);
    assert.ok((indiceQualitePct(mauvais) ?? 0) < 0);
  });

  it('signale une estimation peu fiable sous 8 critères', () => {
    assert.equal(estimationPeuFiable(grilleVide()), true);
    const sept: Record<string, { valeur: 3; source: 'agent' }> = {};
    for (const id of [
      'standing',
      'etat_general',
      'luminosite',
      'vue',
      'calme',
      'quartier',
      'commerces',
    ]) {
      sept[id] = { valeur: 3, source: 'agent' };
    }
    assert.equal(estimationPeuFiable(sept), true);
    sept.transports = { valeur: 3, source: 'agent' };
    assert.equal(estimationPeuFiable(sept), false);
  });

  it('préremplit le DPE depuis les données, sans écraser l’agent', () => {
    const depuisDonnees = preremplirDepuisDpe({}, 'A');
    assert.equal(depuisDonnees.dpe_ressenti?.valeur, 5);
    assert.equal(depuisDonnees.dpe_ressenti?.source, 'donnees');

    const garde = preremplirDepuisDpe(
      { dpe_ressenti: { valeur: 2, source: 'agent' } },
      'A',
    );
    assert.equal(garde.dpe_ressenti?.valeur, 2);
    assert.equal(garde.dpe_ressenti?.source, 'agent');
  });

  it('convertit un comptage en note 1–5', () => {
    const paliers = [1, 4, 10, 20] as const;
    assert.equal(noteDepuisComptage(0, paliers), 1);
    assert.equal(noteDepuisComptage(2, paliers), 2);
    assert.equal(noteDepuisComptage(4, paliers), 3);
    assert.equal(noteDepuisComptage(12, paliers), 4);
    assert.equal(noteDepuisComptage(20, paliers), 5);
  });

  it('préremplit commerces et quartier depuis le public, sans écraser l’agent', () => {
    const vide = preremplirDepuisPublic({}, { commerces: 12, transports: 6, dpeClass: 'C' });
    assert.equal(vide.commerces?.valeur, 4);
    assert.equal(vide.transports?.valeur, 4);
    assert.equal(vide.quartier?.source, 'donnees');
    assert.equal(vide.dpe_ressenti?.valeur, 4);

    const garde = preremplirDepuisPublic(
      { commerces: { valeur: 1, source: 'agent' } },
      { commerces: 30, transports: 8 },
    );
    assert.equal(garde.commerces?.valeur, 1);
    assert.equal(garde.transports?.valeur, 4);
  });

  it('fusionne le public sans écraser une note agent locale', () => {
    const merge = fusionnerGrille(
      { standing: { valeur: 5, source: 'agent' } },
      { standing: { valeur: 3, source: 'donnees' }, commerces: { valeur: 4, source: 'donnees' } },
    );
    assert.equal(merge.standing?.valeur, 5);
    assert.equal(merge.commerces?.valeur, 4);
  });
});
