import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseNoteExtraction } from './propositions';
import { prochainJourSemaine, resolveDans, resolvePromesseEcheance, resolveRendezVous } from './date-relative';

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
    const h = new Date(plage!.debut).getHours();
    assert.equal(h, 14);
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
