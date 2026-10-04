import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { proposerImmeublesSuivis, type EvenementsImmeuble, type ImmeubleSuivi } from './immeubles-suivis';

const NOW = new Date('2026-10-03T08:00:00Z');
const suivi: ImmeubleSuivi = {
  parcelleId: '75120000AB0042',
  banId: '75120_1234_00018',
  libelle: '18 rue des Lilas',
  profileId: 'agent-1',
  creeLe: '2026-09-01T10:00:00Z',
};

function evenements(partiel: Partial<EvenementsImmeuble>): Map<string, EvenementsImmeuble> {
  return new Map([[suivi.parcelleId, { dpe: [], ventes: [], audits: [], ...partiel }]]);
}

describe('proposerImmeublesSuivis', () => {
  it('ne propose que ce qui est arrivé après le début du suivi', () => {
    const r = proposerImmeublesSuivis({
      suivis: [suivi],
      evenements: evenements({
        dpe: [
          { numero: 'D-ancien', date: '2025-01-01', etiquette: 'D', surface: 40, etage: 2, creeLe: '2026-02-01T00:00:00Z' },
          { numero: 'D-neuf', date: '2026-09-20', etiquette: 'G', surface: 62, etage: 4, creeLe: '2026-09-25T00:00:00Z' },
        ],
      }),
      now: NOW,
    });
    assert.equal(r.length, 1);
    assert.equal(r[0]!.titre, '18 rue des Lilas : nouveau DPE (G)');
    assert.equal(r[0]!.assignedTo, 'agent-1');
    assert.equal(r[0]!.score, 90);
    assert.deepEqual(r[0]!.payload, { parcelleId: suivi.parcelleId, banId: suivi.banId });
  });

  it('juge une vente à son entrée dans les données, pas à la date de l’acte', () => {
    const r = proposerImmeublesSuivis({
      suivis: [suivi],
      evenements: evenements({
        ventes: [
          { date: '2026-03-12', prix: 441_000, typeLocal: 'Appartement', surface: 45, pieces: 2, creeLe: '2026-09-15T00:00:00Z' },
        ],
      }),
      now: NOW,
    });
    assert.equal(r.length, 1);
    assert.match(r[0]!.detail!, /^T2 · 45 m² · 441\s000 €\. Acte du 12\/03\/2026/);
  });

  it('met l’audit en tête et plafonne à trois propositions par immeuble', () => {
    const dpe = [1, 2, 3, 4].map((i) => ({
      numero: `D${i}`,
      date: '2026-09-20',
      etiquette: 'C',
      surface: 30 + i,
      etage: i,
      creeLe: '2026-09-25T00:00:00Z',
    }));
    const r = proposerImmeublesSuivis({
      suivis: [suivi],
      evenements: evenements({
        dpe,
        audits: [
          { numero: 'A1', date: '2026-09-10', banId: null, classeActuelle: 'F', classeVisee: 'B', typologie: null, surface: null, etage: null },
        ],
      }),
      now: NOW,
    });
    assert.equal(r.length, 3);
    assert.equal(r[0]!.titre, '18 rue des Lilas : audit énergétique');
    assert.match(r[0]!.detail!, /^F → B après travaux/);
  });

  it('donne une clé stable : la même nouvelle ne revient pas', () => {
    const ev = evenements({
      dpe: [{ numero: 'D-neuf', date: '2026-09-20', etiquette: 'G', surface: 62, etage: 4, creeLe: '2026-09-25T00:00:00Z' }],
    });
    const a = proposerImmeublesSuivis({ suivis: [suivi], evenements: ev, now: NOW });
    const b = proposerImmeublesSuivis({ suivis: [suivi], evenements: ev, now: new Date('2026-10-04T08:00:00Z') });
    assert.equal(a[0]!.dedupKey, b[0]!.dedupKey);
  });
});
