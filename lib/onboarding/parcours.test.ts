import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildParcours,
  decideAffichage,
  doitProposerReprise,
  etapeDeReprise,
  etapeSuivante,
  etatOnboarding,
  minutesRestantes,
  rangEtape,
} from './parcours';

const complet = { aDesLeads: true, aDesParcelles: true, aUneSortie: true, mobile: false };

describe('buildParcours', () => {
  it('déroule les cinq étapes sur poste fixe', () => {
    assert.deepEqual(buildParcours(complet), ['secteur', 'lead', 'note', 'immeuble', 'sortie']);
  });

  it('place la dictée en deuxième sur téléphone', () => {
    assert.deepEqual(buildParcours({ ...complet, mobile: true }), [
      'secteur',
      'note',
      'lead',
      'immeuble',
      'sortie',
    ]);
  });

  it('saute l’immeuble quand le secteur n’a pas de données publiques', () => {
    const parcours = buildParcours({ ...complet, aDesParcelles: false });
    assert.ok(!parcours.includes('immeuble'));
    assert.deepEqual(parcours, ['secteur', 'lead', 'note', 'sortie']);
  });

  it('saute la sortie quand aucune tournée n’est calculable', () => {
    const parcours = buildParcours({ ...complet, aUneSortie: false });
    assert.ok(!parcours.includes('sortie'));
  });

  it('saute la prise de lead quand il n’y a rien à prendre', () => {
    assert.deepEqual(buildParcours({ ...complet, aDesLeads: false }), [
      'secteur',
      'note',
      'immeuble',
      'sortie',
    ]);
  });

  it('garde toujours au moins le secteur et la dictée', () => {
    assert.deepEqual(
      buildParcours({ aDesLeads: false, aDesParcelles: false, aUneSortie: false, mobile: false }),
      ['secteur', 'note'],
    );
  });
});

describe('navigation', () => {
  const parcours = buildParcours(complet);

  it('numérote sur le parcours réel, pas sur les cinq étapes théoriques', () => {
    const court = buildParcours({ ...complet, aDesParcelles: false });
    assert.equal(rangEtape(court, 'sortie'), 4);
    assert.equal(court.length, 4);
  });

  it('sait s’arrêter à la dernière étape', () => {
    assert.equal(etapeSuivante(parcours, 'immeuble'), 'sortie');
    assert.equal(etapeSuivante(parcours, 'sortie'), null);
  });
});

describe('etapeDeReprise', () => {
  const parcours = buildParcours(complet);

  it('reprend là où l’agent s’est arrêté', () => {
    assert.equal(etapeDeReprise(parcours, 'note', ['secteur', 'lead']), 'note');
  });

  it('repart de la première étape non atteinte si l’étape enregistrée a disparu', () => {
    const court = buildParcours({ ...complet, aDesParcelles: false });
    assert.equal(etapeDeReprise(court, 'immeuble', ['secteur', 'lead']), 'note');
  });

  it('ne renvoie jamais rien sur un parcours entièrement atteint', () => {
    assert.equal(etapeDeReprise(parcours, null, [...parcours]), 'sortie');
  });
});

describe('etatOnboarding', () => {
  it('distingue les quatre états', () => {
    assert.equal(etatOnboarding(null), 'jamais_ouvert');
    assert.equal(
      etatOnboarding({ startedAt: '2026-08-01T09:00:00Z', completedAt: null, skippedAt: null }),
      'en_cours',
    );
    assert.equal(
      etatOnboarding({
        startedAt: '2026-08-01T09:00:00Z',
        completedAt: '2026-08-01T09:04:00Z',
        skippedAt: null,
      }),
      'termine',
    );
    assert.equal(
      etatOnboarding({
        startedAt: '2026-08-01T09:00:00Z',
        completedAt: null,
        skippedAt: '2026-08-01T09:01:00Z',
      }),
      'passe',
    );
  });
});

describe('doitProposerReprise', () => {
  const enCours = {
    startedAt: '2026-08-01T09:00:00Z',
    completedAt: null,
    skippedAt: null,
    relanceDismissedAt: null,
  };

  it('propose une reprise à qui a commencé sans finir', () => {
    assert.equal(doitProposerReprise(enCours), true);
  });

  it('ne relance plus après un refus', () => {
    assert.equal(
      doitProposerReprise({ ...enCours, relanceDismissedAt: '2026-08-02T09:00:00Z' }),
      false,
    );
  });

  it('ne relance ni les terminés ni ceux qui ont passé', () => {
    assert.equal(doitProposerReprise({ ...enCours, completedAt: '2026-08-01T09:05:00Z' }), false);
    assert.equal(doitProposerReprise({ ...enCours, skippedAt: '2026-08-01T09:01:00Z' }), false);
  });

  it('ne propose rien à qui n’a jamais ouvert', () => {
    assert.equal(doitProposerReprise(null), false);
  });
});

describe('minutesRestantes', () => {
  it('annonce une durée qui ne ment pas', () => {
    const parcours = buildParcours(complet);
    assert.equal(minutesRestantes(parcours, []), 4);
    assert.equal(minutesRestantes(parcours, ['secteur', 'lead', 'note']), 2);
    assert.equal(minutesRestantes(parcours, [...parcours]), 1);
  });
});

describe('decideAffichage', () => {
  const now = new Date('2026-08-28T12:00:00.000Z');
  const base = {
    startedAt: '2026-08-28T11:50:00.000Z',
    lastSeenAt: '2026-08-28T11:55:00.000Z',
    completedAt: null,
    skippedAt: null,
    relanceDismissedAt: null,
  };

  it('ouvre le parcours à la toute première visite', () => {
    assert.equal(decideAffichage(null, { demandeExplicite: false, now }), 'onboarding');
  });

  it('poursuit le parcours dans la même session', () => {
    assert.equal(decideAffichage(base, { demandeExplicite: false, now }), 'onboarding');
  });

  it('rend l’Accueil normal le lendemain, avec une bande', () => {
    const hier = { ...base, lastSeenAt: '2026-08-27T11:55:00.000Z' };
    assert.equal(decideAffichage(hier, { demandeExplicite: false, now }), 'bande');
  });

  it('ne relance plus après un refus', () => {
    const refuse = {
      ...base,
      lastSeenAt: '2026-08-27T11:55:00.000Z',
      relanceDismissedAt: '2026-08-27T12:00:00.000Z',
    };
    assert.equal(decideAffichage(refuse, { demandeExplicite: false, now }), 'rien');
  });

  it('n’impose rien à qui a cliqué « Passer »', () => {
    const passe = { ...base, skippedAt: '2026-08-28T11:56:00.000Z' };
    assert.equal(decideAffichage(passe, { demandeExplicite: false, now }), 'rien');
  });

  it('rouvre le parcours sur demande explicite, même après un « Passer »', () => {
    const passe = { ...base, skippedAt: '2026-08-28T11:56:00.000Z' };
    assert.equal(decideAffichage(passe, { demandeExplicite: true, now }), 'onboarding');
  });

  it('ne rouvre jamais un parcours terminé', () => {
    const fini = { ...base, completedAt: '2026-08-28T11:58:00.000Z' };
    assert.equal(decideAffichage(fini, { demandeExplicite: true, now }), 'rien');
  });
});
