import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  intervalleGlissant,
  intervalleSeptJours,
  normaliserPeriode,
  vuePeriode,
  vueSurIntervalle,
} from './semaines';

// Mercredi 9 septembre 2026, midi UTC.
const MAINTENANT = new Date('2026-09-09T12:00:00Z');

describe('vue d’une période', () => {
  it('sans ancre, cadre les N derniers jours', () => {
    assert.deepEqual(vuePeriode('7j', null, MAINTENANT).intervalle, {
      debut: '2026-09-03',
      fin: '2026-09-09',
    });
    assert.deepEqual(vuePeriode('30j', null, MAINTENANT).intervalle, {
      debut: '2026-08-11',
      fin: '2026-09-09',
    });
    assert.deepEqual(vuePeriode('90j', null, MAINTENANT).intervalle, {
      debut: '2026-06-12',
      fin: '2026-09-09',
    });
  });

  it('reconnaît la période en cours pour chaque preset', () => {
    for (const periode of ['7j', '30j', '90j'] as const) {
      assert.equal(vuePeriode(periode, null, MAINTENANT).estPeriodeCourante, true, periode);
    }
  });

  it('une plage choisie n’est jamais la période en cours', () => {
    const vue = vuePeriode('custom', '2026-09-01', MAINTENANT, '2026-09-05');
    assert.equal(vue.estPeriodeCourante, false);
    assert.deepEqual(vue.intervalle, { debut: '2026-09-01', fin: '2026-09-05' });
  });

  it('un jour isolé au calendrier tient sur ce jour', () => {
    const vue = vuePeriode('custom', '2026-09-02', MAINTENANT, '2026-09-02');
    assert.deepEqual(vue.intervalle, { debut: '2026-09-02', fin: '2026-09-02' });
  });

  it('la clé distingue la fenêtre autant que le preset', () => {
    const sept = vuePeriode('7j', null, MAINTENANT);
    const trente = vuePeriode('30j', null, MAINTENANT);
    assert.equal(sept.cle, '7j|2026-09-03|2026-09-09');
    assert.notEqual(sept.cle, trente.cle);
  });

  it('la même période demandée deux fois donne la même clé', () => {
    const parAncre = vuePeriode('7j', '2026-09-09', MAINTENANT);
    const parDefaut = vuePeriode('7j', null, MAINTENANT);
    assert.equal(parAncre.cle, parDefaut.cle);
  });
});

describe('normaliserPeriode', () => {
  it('ramène les anciennes clés d’URL', () => {
    assert.equal(normaliserPeriode('semaine'), '7j');
    assert.equal(normaliserPeriode('mois'), '30j');
    assert.equal(normaliserPeriode('annee'), '90j');
    assert.equal(normaliserPeriode('jour'), 'custom');
    assert.equal(normaliserPeriode(null), '7j');
  });
});

describe('intervalleGlissant', () => {
  it('compte les bornes : 7 jours = aujourd’hui et les 6 précédents', () => {
    assert.deepEqual(intervalleGlissant(7, MAINTENANT), {
      debut: '2026-09-03',
      fin: '2026-09-09',
    });
  });
});

describe('intervalleSeptJours', () => {
  it('cadre lundi → lundi, mardi → mardi', () => {
    assert.deepEqual(intervalleSeptJours('2026-09-14'), {
      debut: '2026-09-07',
      fin: '2026-09-14',
    });
    assert.deepEqual(intervalleSeptJours('2026-09-15'), {
      debut: '2026-09-08',
      fin: '2026-09-15',
    });
  });
});

describe('vueSurIntervalle', () => {
  it('un 7j décalé n’est pas la période en cours', () => {
    const vue = vueSurIntervalle(
      '7j',
      { debut: '2026-08-27', fin: '2026-09-02' },
      MAINTENANT,
    );
    assert.equal(vue.estPeriodeCourante, false);
  });
});
