import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildParcours,
  decideAffichage,
  doitProposerReprise,
  etapeDeReprise,
  etapePrecedente,
  etapeSuivante,
  etatOnboarding,
  minutesRestantes,
  peutPasser,
  rangEtape,
} from './parcours';

const complet = { aDesLeads: true, aDesParcelles: true, aUneSortie: true, mobile: false };

describe('buildParcours', () => {
  it('ouvre par salut → lettre → anniversaire → avatar', () => {
    const p = buildParcours(complet);
    assert.deepEqual(p.slice(0, 4), ['salut', 'lettre', 'anniversaire', 'avatar']);
    assert.equal(p[p.length - 1], 'final');
  });

  it('sur desktop : secteur, lead, note parmi les gestes', () => {
    const p = buildParcours(complet);
    assert.deepEqual(p.slice(4, -1), ['secteur', 'lead', 'note', 'immeuble', 'sortie']);
  });

  it('sur mobile place la dictée en tête des gestes', () => {
    const p = buildParcours({ ...complet, mobile: true });
    assert.deepEqual(p.slice(4, -1), ['note', 'secteur', 'lead', 'immeuble', 'sortie']);
  });

  it('saute immeuble / sortie / lead si données absentes', () => {
    assert.deepEqual(
      buildParcours({
        aDesLeads: false,
        aDesParcelles: false,
        aUneSortie: false,
        mobile: false,
      }),
      ['salut', 'lettre', 'anniversaire', 'avatar', 'secteur', 'note', 'final'],
    );
  });
});

describe('peutPasser', () => {
  const p = buildParcours(complet);
  it('est masqué sur salut et lettre', () => {
    assert.equal(peutPasser('salut', p), false);
    assert.equal(peutPasser('lettre', p), false);
  });
  it('apparaît dès l’anniversaire', () => {
    assert.equal(peutPasser('anniversaire', p), true);
    assert.equal(peutPasser('avatar', p), true);
  });
});

describe('navigation', () => {
  const parcours = buildParcours(complet);

  it('numérote sur le parcours réel', () => {
    assert.equal(rangEtape(parcours, 'salut'), 1);
    assert.equal(rangEtape(parcours, 'final'), parcours.length);
  });

  it('enchaîne jusqu’au final', () => {
    assert.equal(etapeSuivante(parcours, 'sortie'), 'final');
    assert.equal(etapeSuivante(parcours, 'final'), null);
  });

  it('remonte d’une étape', () => {
    assert.equal(etapePrecedente(parcours, 'salut'), null);
    assert.equal(etapePrecedente(parcours, 'lettre'), 'salut');
    assert.equal(etapePrecedente(parcours, 'final'), 'sortie');
  });
});

describe('etapeDeReprise', () => {
  const parcours = buildParcours(complet);

  it('reprend l’étape enregistrée', () => {
    assert.equal(etapeDeReprise(parcours, 'avatar', ['salut', 'lettre']), 'avatar');
  });

  it('repart de la première non atteinte si l’étape a disparu', () => {
    const court = buildParcours({ ...complet, aDesParcelles: false });
    assert.equal(etapeDeReprise(court, 'immeuble', ['salut', 'lettre', 'anniversaire', 'avatar', 'secteur', 'lead']), 'note');
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
});

describe('minutesRestantes', () => {
  it('annonce une durée réaliste', () => {
    const parcours = buildParcours(complet);
    assert.ok(minutesRestantes(parcours, []) >= 1);
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

  it('ouvre à la première visite', () => {
    assert.equal(decideAffichage(null, { demandeExplicite: false, now }), 'onboarding');
  });

  it('poursuit dans la même session', () => {
    assert.equal(decideAffichage(base, { demandeExplicite: false, now }), 'onboarding');
  });

  it('rend l’Accueil le lendemain (bande via doitProposerReprise)', () => {
    const hier = { ...base, lastSeenAt: '2026-08-27T11:55:00.000Z' };
    assert.equal(decideAffichage(hier, { demandeExplicite: false, now }), 'rien');
    assert.equal(doitProposerReprise(hier), true);
  });

  it('ne rouvre jamais un parcours terminé', () => {
    const fini = { ...base, completedAt: '2026-08-28T11:58:00.000Z' };
    assert.equal(decideAffichage(fini, { demandeExplicite: true, now }), 'rien');
  });
});
