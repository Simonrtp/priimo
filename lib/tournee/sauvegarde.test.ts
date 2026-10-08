import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { lireTourneeSauvee, type TourneeSauvee } from './sauvegarde';

const MAINTENANT = new Date('2026-10-08T10:00:00+02:00');

function tournee(extra: Partial<TourneeSauvee> = {}): TourneeSauvee {
  return {
    v: 1,
    jour: '2026-10-08',
    phase: 'route',
    arrets: [
      {
        key: 'ban:a',
        leadId: 'ban:a',
        address: '2 rue A',
        latitude: 48.86,
        longitude: 2.34,
        score: 0,
        surfaceM2: null,
        etage: null,
        mainSignalLabel: 'DPE F il y a 3 jours',
        notes: null,
        banId: 'a',
        postalCode: '75011',
        detail: { dpe: null, lead: null, dernierPassage: null, choisie: false },
      },
    ],
    depart: { latitude: 48.861, longitude: 2.341 },
    trajet: {
      cle: 'ban:a@48.86100,2.34100',
      keys: ['ban:a'],
      geometry: { type: 'LineString', coordinates: [[2.341, 48.861], [2.34, 48.86]] },
      distanceM: 180,
      durationS: 130,
    },
    faits: ['ban:a'],
    suivi: { actifMs: 60_000, repriseLe: 1_000, distanceM: 120, dernier: null },
    prevuMinutes: 10,
    sansPosition: false,
    ...extra,
  };
}

describe('sauvegarde de tournée', () => {
  it('relit la tournée du jour telle quelle', () => {
    const t = tournee();
    assert.deepEqual(lireTourneeSauvee(JSON.stringify(t), MAINTENANT), t);
  });

  it('oublie celle de la veille', () => {
    assert.equal(lireTourneeSauvee(JSON.stringify(tournee({ jour: '2026-10-07' })), MAINTENANT), null);
  });

  it('oublie une sauvegarde abîmée', () => {
    assert.equal(lireTourneeSauvee('{pas du json', MAINTENANT), null);
    assert.equal(lireTourneeSauvee(JSON.stringify({ ...tournee(), arrets: [] }), MAINTENANT), null);
    assert.equal(lireTourneeSauvee(JSON.stringify({ ...tournee(), suivi: null }), MAINTENANT), null);
  });

  it('garde la tournée même si le tracé est illisible', () => {
    const relue = lireTourneeSauvee(JSON.stringify({ ...tournee(), trajet: { cle: 1 } }), MAINTENANT);
    assert.equal(relue?.trajet, null);
    assert.equal(relue?.arrets.length, 1);
  });
});
