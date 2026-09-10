import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { jourSemaineParis, libelleModeDuJour, modeDuJour, zoneDuJour } from './jour';
import type { Zone } from './types';

const MOI = 'moi';

function zone(id: string, jourSemaine: number | null, assignedTo: string | null = MOI): Zone {
  return {
    id,
    agencyId: 'a1',
    nom: `Zone ${id}`,
    couleur: '#4C7A9E',
    assignedTo,
    jourSemaine,
    actif: true,
    regles: [],
  };
}

// Mardi 8 septembre 2026, 9 h à Paris.
const MARDI = new Date('2026-09-08T07:00:00Z');
// Vendredi 11 septembre 2026.
const VENDREDI = new Date('2026-09-11T07:00:00Z');

describe('jour de la semaine à Paris', () => {
  it('compte lundi comme 1', () => {
    assert.equal(jourSemaineParis(new Date('2026-09-07T07:00:00Z')), 1);
    assert.equal(jourSemaineParis(MARDI), 2);
    assert.equal(jourSemaineParis(VENDREDI), 5);
    assert.equal(jourSemaineParis(new Date('2026-09-13T07:00:00Z')), 7);
  });

  it('reste en heure de Paris à la bascule de minuit UTC', () => {
    // Mardi 23 h à Paris, soit mardi 21 h UTC : toujours mardi.
    assert.equal(jourSemaineParis(new Date('2026-09-08T21:00:00Z')), 2);
    // Mercredi 0 h 30 à Paris, soit mardi 22 h 30 UTC : déjà mercredi.
    assert.equal(jourSemaineParis(new Date('2026-09-08T22:30:00Z')), 3);
  });
});

describe('mode du jour', () => {
  it('donne la zone prévue aujourd’hui', () => {
    const mode = modeDuJour([zone('a', 1), zone('b', 2)], MOI, MARDI);
    assert.equal(mode.mode, 'secteur');
    if (mode.mode !== 'secteur') return;
    assert.equal(mode.zone.id, 'b');
    assert.equal(libelleModeDuJour(mode), 'Aujourd’hui : Zone b');
  });

  it('bascule en relances le vendredi sans secteur', () => {
    const mode = modeDuJour([zone('a', 1), zone('b', 2)], MOI, VENDREDI);
    assert.equal(mode.mode, 'relances');
    assert.equal(libelleModeDuJour(mode), 'Aucun secteur aujourd’hui : journée de relances');
  });

  it('accepte un secteur le vendredi si l’agence en a décidé un', () => {
    const mode = modeDuJour([zone('a', 5)], MOI, VENDREDI);
    assert.equal(mode.mode, 'secteur');
  });

  it('ne change rien quand aucun secteur n’a de jour', () => {
    const mode = modeDuJour([zone('a', null)], MOI, VENDREDI);
    assert.equal(mode.mode, 'libre');
    assert.equal(libelleModeDuJour(mode), null);
    assert.equal(zoneDuJour([zone('a', null)], MOI, MARDI), null);
  });

  it('ignore les secteurs des collègues', () => {
    const mode = modeDuJour([zone('a', 2, 'thomas')], MOI, MARDI);
    assert.equal(mode.mode, 'libre');
  });

  it('ignore un secteur désactivé', () => {
    const eteinte: Zone = { ...zone('a', 2), actif: false };
    assert.equal(modeDuJour([eteinte], MOI, MARDI).mode, 'libre');
  });

  it('n’attribue aucun secteur le week-end', () => {
    const samedi = new Date('2026-09-12T07:00:00Z');
    assert.equal(modeDuJour([zone('a', 1), zone('b', 5)], MOI, samedi).mode, 'relances');
  });
});
