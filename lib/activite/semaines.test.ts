import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { intervalleSeptJours, vuePeriode, vueSurIntervalle } from './semaines';

// Mercredi 9 septembre 2026, midi UTC.
const MAINTENANT = new Date('2026-09-09T12:00:00Z');

describe('vue d’une période', () => {
  it('sans ancre, cadre la période en cours', () => {
    assert.deepEqual(vuePeriode('jour', null, MAINTENANT).intervalle, {
      debut: '2026-09-09',
      fin: '2026-09-09',
    });
    assert.deepEqual(vuePeriode('semaine', null, MAINTENANT).intervalle, {
      debut: '2026-09-07',
      fin: '2026-09-13',
    });
    assert.deepEqual(vuePeriode('mois', null, MAINTENANT).intervalle, {
      debut: '2026-09-01',
      fin: '2026-09-30',
    });
    assert.deepEqual(vuePeriode('annee', null, MAINTENANT).intervalle, {
      debut: '2026-01-01',
      fin: '2026-12-31',
    });
  });

  it('reconnaît la période en cours, quelle que soit la granularité', () => {
    for (const periode of ['jour', 'semaine', 'mois', 'annee'] as const) {
      assert.equal(vuePeriode(periode, null, MAINTENANT).estPeriodeCourante, true, periode);
    }
  });

  it('un jour de la semaine en cours donne quand même la semaine en cours', () => {
    // Lundi de la même semaine : la granularité l'emporte sur l'ancre.
    const vue = vuePeriode('semaine', '2026-09-07', MAINTENANT);
    assert.equal(vue.estPeriodeCourante, true);
    assert.deepEqual(vue.intervalle, { debut: '2026-09-07', fin: '2026-09-13' });
  });

  it('une ancre passée n’est pas la période en cours', () => {
    assert.equal(vuePeriode('mois', '2026-08-15', MAINTENANT).estPeriodeCourante, false);
    assert.equal(vuePeriode('annee', '2025-03-02', MAINTENANT).estPeriodeCourante, false);
  });

  it('la clé distingue la granularité autant que la date', () => {
    // Le 1er septembre ouvre à la fois le mois et une semaine : sans la
    // granularité dans la clé, le cache servirait le mauvais bilan.
    const mois = vuePeriode('mois', '2026-09-01', MAINTENANT);
    const semaine = vueSurIntervalle('semaine', { debut: '2026-09-01', fin: '2026-09-06' });
    assert.equal(mois.cle, 'mois|2026-09-01');
    assert.notEqual(mois.cle, semaine.cle);
  });

  it('la même période demandée deux fois donne la même clé', () => {
    // C'est ce qui rend le retour sur une période déjà vue instantané.
    const parAncre = vuePeriode('mois', '2026-09-09', MAINTENANT);
    const parDefaut = vuePeriode('mois', null, MAINTENANT);
    assert.equal(parAncre.cle, parDefaut.cle);
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
