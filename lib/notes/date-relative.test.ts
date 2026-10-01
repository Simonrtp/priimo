import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseNoteExtraction } from './propositions';
import {
  dateParisIso,
  parseIsoDateTime,
  prochainJourSemaine,
  resolveDans,
  resolvePromesseEcheance,
  resolveRendezVous,
  resoudreQuand,
} from './date-relative';

function heureParis(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

const REF = new Date('2026-08-20T12:00:00.000Z'); // jeudi

describe('resolveDans', () => {
  it('résout jeudi depuis un jeudi', () => {
    const d = resolveDans('je le rappelle jeudi', REF);
    assert.ok(d);
    assert.equal(d.getDay(), 4);
  });

  it('résout demain', () => {
    const d = resolveDans('on se revoit demain', REF);
    assert.equal(d?.toISOString().slice(0, 10), '2026-08-21');
  });
});

describe('resolvePromesseEcheance', () => {
  it('extrait une échéance depuis la phrase', () => {
    const iso = resolvePromesseEcheance('je le rappelle lundi', REF);
    assert.ok(iso);
    assert.match(iso!, /^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('resolveRendezVous', () => {
  it('propose une plage matin sans heure', () => {
    const plage = resolveRendezVous('RDV samedi matin', REF);
    assert.ok(plage);
    assert.ok(Date.parse(plage!.debut) < Date.parse(plage!.fin));
  });

  it('lit mardi 14h', () => {
    const plage = resolveRendezVous('visite mardi 14h', REF);
    assert.ok(plage);
    assert.equal(heureParis(plage!.debut), '14:00');
  });

  it('compte l’heure en heure de Paris, pas en heure du serveur', () => {
    const plage = resolveRendezVous('visite demain 9h30', REF);
    assert.equal(plage?.debut, '2026-08-21T07:30:00.000Z');
  });
});

describe('parseIsoDateTime', () => {
  it('lit une heure sans fuseau comme l’heure de Paris (été)', () => {
    assert.equal(parseIsoDateTime('2026-09-15T15:00'), '2026-09-15T13:00:00.000Z');
  });

  it('lit une heure sans fuseau comme l’heure de Paris (hiver)', () => {
    assert.equal(parseIsoDateTime('2026-12-03T15:00'), '2026-12-03T14:00:00.000Z');
  });

  it('respecte un fuseau explicite', () => {
    assert.equal(parseIsoDateTime('2026-09-15T15:00:00Z'), '2026-09-15T15:00:00.000Z');
  });

  it('rejette le texte', () => {
    assert.equal(parseIsoDateTime('jeudi'), null);
  });
});

describe('dateParisIso', () => {
  it('donne le jour de Paris juste après minuit', () => {
    // 23h30 UTC le 20 = 1h30 à Paris le 21.
    assert.equal(dateParisIso(new Date('2026-08-20T23:30:00Z')), '2026-08-21');
  });

  it('après-demain ne se confond pas avec demain', () => {
    assert.equal(resolveDans('on se voit après-demain', REF)?.toISOString().slice(0, 10), '2026-08-22');
  });
});

describe('parseNoteExtraction promesse', () => {
  it('parse une promesse ISO', () => {
    const parsed = parseNoteExtraction(
      JSON.stringify({
        promesse: { intitule: 'Rappeler pour le financement', echeance_iso: '2026-08-25' },
      }),
      REF,
    );
    assert.equal(parsed.promesse?.intitule, 'Rappeler pour le financement');
    assert.equal(parsed.promesse?.echeance, '2026-08-25');
  });
});

describe('prochainJourSemaine', () => {
  it('renvoie le prochain lundi', () => {
    const d = prochainJourSemaine(REF, 1);
    assert.equal(d.getDay(), 1);
    assert.ok(d > REF);
  });
});

describe('resoudreQuand', () => {
  // Mercredi 30 septembre 2026, 10h à Paris.
  const MERCREDI = new Date('2026-09-30T08:00:00Z');
  it('« jeudi à 14h » dicté un mercredi = le lendemain, 14h', () => {
    assert.deepEqual(resoudreQuand('jeudi à 14h', MERCREDI), { date: '2026-10-01', heure: '14:00' });
  });
  it('« dans deux jours », « ce soir », « la semaine prochaine »', () => {
    assert.equal(resoudreQuand('dans 2 jours', MERCREDI)?.date, '2026-10-02');
    assert.equal(resoudreQuand('ce soir', MERCREDI)?.date, '2026-09-30');
    assert.equal(resoudreQuand('la semaine prochaine', MERCREDI)?.date, '2026-10-05');
  });
  it('laisse au modèle une date écrite en toutes lettres', () => {
    assert.equal(resoudreQuand('le 15 octobre', MERCREDI), null);
    assert.equal(resoudreQuand(null, MERCREDI), null);
  });
});
