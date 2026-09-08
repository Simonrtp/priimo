import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  compteursAgence,
  compteursSemaine,
  journalVide,
  type JournalActivite,
} from './derive';
import { semaineDe, semaineDecalee } from './semaines';

const MOI = 'profil-moi';
const AUTRE = 'profil-autre';

/** Semaine du lundi 1er septembre 2026 au dimanche 7 septembre. */
const SEMAINE = semaineDe(new Date('2026-09-02T10:00:00Z'));

function journal(partiel: Partial<JournalActivite>): JournalActivite {
  return { ...journalVide(), ...partiel };
}

describe('compteursSemaine — compteurs dérivés', () => {
  it('compte les transitions vers contacte, estimation et mandat', () => {
    const c = compteursSemaine({
      profileId: MOI,
      semaine: SEMAINE,
      journal: journal({
        transitions: [
          { leadId: 'lead-a', profileId: MOI, depuisCle: null, versCle: 'contacte', createdAt: '2026-09-02T09:00:00Z', banId: 'a' },
          { leadId: 'lead-b', profileId: MOI, depuisCle: null, versCle: 'contacte', createdAt: '2026-09-03T09:00:00Z', banId: 'b' },
          { leadId: 'lead-a', profileId: MOI, depuisCle: null, versCle: 'estimation', createdAt: '2026-09-04T09:00:00Z', banId: 'a' },
          { leadId: 'lead-a', profileId: MOI, depuisCle: null, versCle: 'mandat', createdAt: '2026-09-05T09:00:00Z', banId: 'a' },
          { leadId: 'lead-c', profileId: MOI, depuisCle: null, versCle: 'pris', createdAt: '2026-09-05T10:00:00Z', banId: 'c' },
        ],
      }),
    });

    assert.equal(c.contacts_qualifies, 2);
    assert.equal(c.estimations, 1);
    assert.equal(c.mandats, 1);
  });

  it('ne compte pas les transitions d’un autre collaborateur', () => {
    const c = compteursSemaine({
      profileId: MOI,
      semaine: SEMAINE,
      journal: journal({
        transitions: [
          { leadId: 'lead-a', profileId: AUTRE, depuisCle: null, versCle: 'mandat', createdAt: '2026-09-03T09:00:00Z', banId: 'a' },
        ],
      }),
    });

    assert.equal(c.mandats, 0);
  });

  it('déduplique les immeubles touchés, toutes origines confondues', () => {
    const c = compteursSemaine({
      profileId: MOI,
      semaine: SEMAINE,
      journal: journal({
        transitions: [
          { leadId: 'lead-imm-1', profileId: MOI, depuisCle: null, versCle: 'pris', createdAt: '2026-09-02T09:00:00Z', banId: 'imm-1' },
        ],
        notes: [
          {
            auteurId: MOI,
            createdAt: '2026-09-03T09:00:00Z',
            banId: 'imm-1',
            rattacheeTerrain: true,
          },
          {
            auteurId: MOI,
            createdAt: '2026-09-03T10:00:00Z',
            banId: 'imm-2',
            rattacheeTerrain: true,
          },
        ],
        contactsPhysiques: [{ profileId: MOI, jour: '2026-09-04', banId: 'imm-3' }],
      }),
    });

    // imm-1 touché deux fois ne compte qu'une fois.
    assert.equal(c.immeubles_prospectes, 3);
  });

  it('ne compte en information terrain que les notes rattachées', () => {
    const c = compteursSemaine({
      profileId: MOI,
      semaine: SEMAINE,
      journal: journal({
        notes: [
          {
            auteurId: MOI,
            createdAt: '2026-09-02T09:00:00Z',
            banId: 'imm-1',
            rattacheeTerrain: true,
          },
          {
            auteurId: MOI,
            createdAt: '2026-09-02T10:00:00Z',
            banId: null,
            rattacheeTerrain: false,
          },
        ],
      }),
    });

    assert.equal(c.informations_terrain, 1);
    assert.equal(c.immeubles_prospectes, 1);
  });

  it('compte les contacts physiques déclarés, un par ligne', () => {
    const c = compteursSemaine({
      profileId: MOI,
      semaine: SEMAINE,
      journal: journal({
        contactsPhysiques: [
          { profileId: MOI, jour: '2026-09-02', banId: 'imm-1' },
          { profileId: MOI, jour: '2026-09-02', banId: 'imm-1' },
          { profileId: AUTRE, jour: '2026-09-02', banId: 'imm-9' },
        ],
      }),
    });

    // Deux rencontres au même immeuble : deux contacts, un immeuble.
    assert.equal(c.contacts_physiques, 2);
    assert.equal(c.immeubles_prospectes, 1);
  });
});

describe('compteursSemaine — bornes de semaine', () => {
  it('exclut le dimanche précédent et le lundi suivant', () => {
    const j = journal({
      transitions: [
        // Dimanche 30 août 23 h 30 Paris = 21 h 30 UTC.
        { leadId: 'lead-a', profileId: MOI, depuisCle: null, versCle: 'mandat', createdAt: '2026-08-30T21:30:00Z', banId: 'a' },
        // Lundi 31 août 00 h 30 Paris — dans la semaine.
        { leadId: 'lead-b', profileId: MOI, depuisCle: null, versCle: 'mandat', createdAt: '2026-08-30T22:30:00Z', banId: 'b' },
        // Dimanche 6 septembre 23 h 30 Paris — dernier instant de la semaine.
        { leadId: 'lead-c', profileId: MOI, depuisCle: null, versCle: 'mandat', createdAt: '2026-09-06T21:30:00Z', banId: 'c' },
        // Lundi 7 septembre 00 h 30 Paris — semaine suivante.
        { leadId: 'lead-d', profileId: MOI, depuisCle: null, versCle: 'mandat', createdAt: '2026-09-06T22:30:00Z', banId: 'd' },
      ],
    });

    const semaine = semaineDe(new Date('2026-09-02T10:00:00Z'));
    assert.deepEqual(semaine, { debut: '2026-08-31', fin: '2026-09-06' });
    assert.equal(compteursSemaine({ journal: j, profileId: MOI, semaine }).mandats, 2);
  });

  it('est rejouable : recalculer une semaine passée redonne le même chiffre', () => {
    const j = journal({
      transitions: [
        { leadId: 'lead-a', profileId: MOI, depuisCle: null, versCle: 'mandat', createdAt: '2026-06-10T09:00:00Z', banId: 'a' },
        { leadId: 'lead-b', profileId: MOI, depuisCle: null, versCle: 'contacte', createdAt: '2026-06-11T09:00:00Z', banId: 'b' },
      ],
    });
    const juin = semaineDe(new Date('2026-06-10T09:00:00Z'));

    const premier = compteursSemaine({ journal: j, profileId: MOI, semaine: juin });
    const second = compteursSemaine({ journal: j, profileId: MOI, semaine: juin });

    assert.deepEqual(premier, second);
    assert.equal(premier.mandats, 1);
    assert.equal(premier.contacts_qualifies, 1);
  });

  it('franchit le changement d’heure sans glisser d’un jour', () => {
    // La France repasse en UTC+1 le dimanche 25 octobre 2026. Un décalage
    // naïf de 7 × 86 400 000 ms depuis le lundi 19 octobre à 00 h 30 Paris
    // retomberait sur le dimanche 25, donc sur la mauvaise semaine.
    const avant = semaineDe(new Date('2026-10-19T10:00:00Z'));
    assert.deepEqual(avant, { debut: '2026-10-19', fin: '2026-10-25' });

    assert.deepEqual(semaineDecalee(avant, 1), { debut: '2026-10-26', fin: '2026-11-01' });
    assert.deepEqual(semaineDecalee(semaineDecalee(avant, 1), -1), avant);
  });
});

describe('compteursAgence', () => {
  it('additionne les collaborateurs', () => {
    const j = journal({
      transitions: [
        { leadId: 'lead-a', profileId: MOI, depuisCle: null, versCle: 'mandat', createdAt: '2026-09-02T09:00:00Z', banId: 'a' },
        { leadId: 'lead-b', profileId: AUTRE, depuisCle: null, versCle: 'mandat', createdAt: '2026-09-03T09:00:00Z', banId: 'b' },
        { leadId: 'lead-b', profileId: AUTRE, depuisCle: null, versCle: 'contacte', createdAt: '2026-09-03T09:00:00Z', banId: 'b' },
      ],
    });

    const total = compteursAgence({ journal: j, profileIds: [MOI, AUTRE], fenetre: SEMAINE });
    assert.equal(total.mandats, 2);
    assert.equal(total.contacts_qualifies, 1);
  });

  it('ignore un collaborateur absent du journal sans planter', () => {
    const total = compteursAgence({
      journal: journalVide(),
      profileIds: [MOI],
      fenetre: SEMAINE,
    });
    assert.equal(total.mandats, 0);
  });
});
