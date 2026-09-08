import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { dateKeyParis } from '@/lib/today/calendar';
import { normaliserEvenements } from './google-calendar';
import { bornesIsoSemaine, grouperParJour, joursDeLaSemaine, minuitParisIso } from './semaine';

describe('joursDeLaSemaine', () => {
  it('commence le lundi et libelle à la française', () => {
    const jours = joursDeLaSemaine(new Date('2026-09-09T10:00:00Z'), '2026-09-08');
    assert.equal(jours.length, 7);
    assert.equal(jours[0]?.cle, '2026-09-07');
    assert.match(jours[0]?.label ?? '', /Lun\.?\s*7/i);
    assert.equal(jours[1]?.aujourdhui, true);
    assert.equal(jours[6]?.cle, '2026-09-13');
  });
});

describe('minuitParisIso', () => {
  it('tombe bien à minuit Paris en été', () => {
    const iso = minuitParisIso('2026-09-07');
    assert.equal(dateKeyParis(new Date(iso)), '2026-09-07');
  });

  it('tombe bien à minuit Paris en hiver', () => {
    const iso = minuitParisIso('2026-01-12');
    assert.equal(dateKeyParis(new Date(iso)), '2026-01-12');
  });
});

describe('bornesIsoSemaine', () => {
  it('couvre lundi → lundi suivant', () => {
    const { timeMin, timeMax } = bornesIsoSemaine(new Date('2026-09-09T10:00:00Z'));
    assert.equal(dateKeyParis(new Date(timeMin)), '2026-09-07');
    assert.equal(dateKeyParis(new Date(timeMax)), '2026-09-14');
  });
});

describe('normaliserEvenements', () => {
  it('sépare journée entière et horaire Paris', () => {
    const evs = normaliserEvenements([
      { id: 'a', summary: 'Visite', start: { date: '2026-09-08' } },
      {
        id: 'b',
        summary: 'Appel',
        start: { dateTime: '2026-09-08T13:00:00+02:00' },
        end: { dateTime: '2026-09-08T13:30:00+02:00' },
      },
    ]);
    assert.equal(evs[0]?.journee, true);
    assert.equal(evs[0]?.jour, '2026-09-08');
    assert.equal(evs[1]?.journee, false);
    assert.equal(evs[1]?.debut, '13:00');
    const parJour = grouperParJour(evs);
    assert.equal(parJour['2026-09-08']?.length, 2);
  });
});
