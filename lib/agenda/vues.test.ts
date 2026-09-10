import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { dateKeyParis } from '@/lib/today/calendar';
import {
  ancreDecalee,
  bornesDeCle,
  cleAgenda,
  cleValide,
  grilleMois,
  libelleVue,
  lundiDe,
} from './vues';

describe('lundiDe', () => {
  it('ramène au lundi, dimanche compris', () => {
    assert.equal(lundiDe('2026-09-09'), '2026-09-07');
    assert.equal(lundiDe('2026-09-07'), '2026-09-07');
    assert.equal(lundiDe('2026-09-13'), '2026-09-07');
  });
});

describe('cleAgenda', () => {
  it('sert le jour dans la semaine, pour éviter un appel de plus', () => {
    assert.equal(cleAgenda('jour', '2026-09-09'), 'semaine:2026-09-07');
    assert.equal(cleAgenda('semaine', '2026-09-09'), 'semaine:2026-09-07');
    assert.equal(cleAgenda('mois', '2026-09-09'), 'mois:2026-09');
  });
});

describe('bornesDeCle', () => {
  it('couvre lundi → lundi suivant pour une semaine', () => {
    const { timeMin, timeMax } = bornesDeCle('semaine:2026-09-07');
    assert.equal(dateKeyParis(new Date(timeMin)), '2026-09-07');
    assert.equal(dateKeyParis(new Date(timeMax)), '2026-09-14');
  });

  it('couvre des semaines entières pour un mois', () => {
    // Septembre 2026 : le 1er est un mardi, le 30 un mercredi.
    const { timeMin, timeMax } = bornesDeCle('mois:2026-09');
    assert.equal(dateKeyParis(new Date(timeMin)), '2026-08-31');
    assert.equal(dateKeyParis(new Date(timeMax)), '2026-10-05');
  });

  it('refuse une clé fabriquée à la main', () => {
    assert.equal(cleValide('semaine:2026-09-07'), true);
    assert.equal(cleValide('mois:2026-09'), true);
    assert.equal(cleValide('mois:2026-09-07'), false);
    assert.equal(cleValide('annee:2026'), false);
  });
});

describe('ancreDecalee', () => {
  it('avance d’un jour, d’une semaine, d’un mois', () => {
    assert.equal(ancreDecalee('jour', '2026-09-09', 1), '2026-09-10');
    assert.equal(ancreDecalee('semaine', '2026-09-09', 1), '2026-09-14');
    assert.equal(ancreDecalee('semaine', '2026-09-09', -1), '2026-08-31');
    assert.equal(ancreDecalee('mois', '2026-09-09', 1), '2026-10-01');
    assert.equal(ancreDecalee('mois', '2026-01-15', -1), '2025-12-01');
  });
});

describe('libelleVue', () => {
  it('nomme la période sans répéter le mois inutilement', () => {
    assert.match(libelleVue('jour', '2026-09-09'), /Mer/);
    assert.equal(libelleVue('semaine', '2026-09-09'), '7 – 13 sept.');
    assert.match(libelleVue('semaine', '2026-08-31'), /août.*sept/);
    assert.match(libelleVue('mois', '2026-09-09'), /^Septembre 2026$/);
  });
});

describe('grilleMois', () => {
  it('rend des semaines entières et marque les jours hors mois', () => {
    const semaines = grilleMois('2026-09-09', '2026-09-09');
    assert.equal(semaines.length, 5);
    assert.equal(semaines[0]?.length, 7);
    assert.equal(semaines[0]?.[0]?.cle, '2026-08-31');
    assert.equal(semaines[0]?.[0]?.horsMois, true);
    assert.equal(semaines[0]?.[1]?.cle, '2026-09-01');
    assert.equal(semaines[0]?.[1]?.horsMois, false);
    const aujourdhui = semaines.flat().filter((c) => c.aujourdhui);
    assert.equal(aujourdhui.length, 1);
    assert.equal(aujourdhui[0]?.numero, 9);
  });
});
