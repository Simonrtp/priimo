import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { etatInstallation, phraseDepuis } from './install-state';

const now = new Date('2026-08-28T12:00:00.000Z');

describe('etatInstallation', () => {
  it('dit « jamais vu » même si l’interrupteur est activé', () => {
    const etat = etatInstallation(
      { enabled: true, lastSeenAt: null, lastSeenHost: null },
      now,
    );
    assert.equal(etat.statut, 'jamais_vu');
  });

  it('signale un widget installé mais coupé', () => {
    const etat = etatInstallation(
      { enabled: false, lastSeenAt: '2026-08-28T10:00:00.000Z', lastSeenHost: 'agence.fr' },
      now,
    );
    assert.equal(etat.statut, 'coupe');
    assert.equal(etat.host, 'agence.fr');
  });

  it('confirme la mise en ligne sur une charge récente', () => {
    const etat = etatInstallation(
      { enabled: true, lastSeenAt: '2026-08-28T10:00:00.000Z', lastSeenHost: 'agence.fr' },
      now,
    );
    assert.equal(etat.statut, 'en_ligne');
  });

  it('alerte quand plus rien ne se charge depuis un mois', () => {
    const etat = etatInstallation(
      { enabled: true, lastSeenAt: '2026-06-01T10:00:00.000Z', lastSeenHost: 'agence.fr' },
      now,
    );
    assert.equal(etat.statut, 'silencieux');
  });

  it('ne se laisse pas piéger par une date illisible', () => {
    const etat = etatInstallation(
      { enabled: true, lastSeenAt: 'hier', lastSeenHost: null },
      now,
    );
    assert.equal(etat.statut, 'jamais_vu');
  });
});

describe('phraseDepuis', () => {
  it('se lit sans calculer', () => {
    assert.equal(phraseDepuis('2026-08-28T11:59:30.000Z', now), 'à l’instant');
    assert.equal(phraseDepuis('2026-08-28T11:30:00.000Z', now), 'il y a 30 minutes');
    assert.equal(phraseDepuis('2026-08-28T10:00:00.000Z', now), 'il y a 2 heures');
    assert.equal(phraseDepuis('2026-08-26T12:00:00.000Z', now), 'il y a 2 jours');
    assert.equal(phraseDepuis('2026-06-28T12:00:00.000Z', now), 'il y a 2 mois');
  });

  it('ne dit rien sans date', () => {
    assert.equal(phraseDepuis(null, now), null);
    assert.equal(phraseDepuis('jamais', now), null);
  });
});
