import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Contact } from '../../types/contact';
import {
  TODAY_CONFIG,
  buildTodayCards,
  estEcartee,
  summarizeTodayCards,
  type TodayLead,
} from './cards';

const MAINTENANT = new Date('2026-08-20T09:00:00.000Z');

function joursAvant(n: number): string {
  return new Date(MAINTENANT.getTime() - n * 86_400_000).toISOString();
}

function contact(name: string, overrides: Partial<Contact> = {}): Contact {
  return {
    id: name,
    agencyId: 'agency-a',
    createdBy: null,
    firstName: name,
    lastName: '',
    fullName: name,
    type: 'acquereur',
    phone: '0601020304',
    email: null,
    secteur: null,
    criteria: {
      budgetMin: null,
      budgetMax: null,
      surfaceMin: null,
      surfaceMax: null,
      roomsMin: null,
      postalCodes: [],
    },
    summary: null,
    lastInteractionAt: joursAvant(1),
    recontacterLe: null,
    doublonDe: null,
    source: 'manuel',
    address: null,
    banId: null,
    latitude: null,
    longitude: null,
    leadId: null,
    assignedTo: null,
    assignedBy: null,
    assignedAt: null,
    createdAt: joursAvant(1),
    updatedAt: joursAvant(1),
    ...overrides,
  };
}

function lead(id: string, overrides: Partial<TodayLead> = {}): TodayLead {
  return {
    id,
    address: `${id} rue du Test`,
    status: 'nouveau',
    score: 80,
    mainSignalLabel: 'DPE récent',
    propertyType: 'Appartement',
    surfaceM2: 70,
    deliveredAt: joursAvant(2),
    createdAt: joursAvant(2),
    latitude: null,
    longitude: null,
    ...overrides,
  };
}

const AUCUN_ECART = new Map<string, string | null>();

describe('buildTodayCards', () => {
  it('ne propose pas de relance avant le délai', () => {
    const cards = buildTodayCards({
      leads: [],
      contacts: [contact('Récent', { lastInteractionAt: joursAvant(3) })],
      rapprochements: [],
      dismissals: AUCUN_ECART,
      now: MAINTENANT,
      plafonner: false,
    });
    assert.equal(cards.length, 0);
  });

  it('propose une relance passé le délai', () => {
    const cards = buildTodayCards({
      leads: [],
      contacts: [contact('Oublié', { lastInteractionAt: joursAvant(10) })],
      rapprochements: [],
      dismissals: AUCUN_ECART,
      now: MAINTENANT,
      plafonner: false,
    });
    assert.equal(cards.length, 1);
    assert.equal(cards[0]?.type, 'relance');
    assert.equal(cards[0]?.action.kind, 'appeler');
  });

  it('ouvre la fiche quand il n’y a pas de numéro', () => {
    const cards = buildTodayCards({
      leads: [],
      contacts: [contact('Sans numéro', { lastInteractionAt: joursAvant(10), phone: null })],
      rapprochements: [],
      dismissals: AUCUN_ECART,
      now: MAINTENANT,
      plafonner: false,
    });
    assert.equal(cards[0]?.action.kind, 'ouvrir_contact');
  });

  it('priorise les relances en retard', () => {
    const cards = buildTodayCards({
      leads: [lead('a')],
      contacts: [contact('EnRetard', { lastInteractionAt: joursAvant(60) })],
      rapprochements: [],
      dismissals: AUCUN_ECART,
      now: MAINTENANT,
      plafonner: false,
    });
    assert.equal(cards[0]?.type, 'relance');
    assert.equal(cards.filter((c) => c.type === 'nouvelle_adresse').length, 0);
  });

  it('n’inclut plus les nouvelles adresses dans la pile', () => {
    const cards = buildTodayCards({
      leads: Array.from({ length: 5 }, (_, i) => lead(`lead-${i}`)),
      contacts: [],
      rapprochements: [],
      dismissals: AUCUN_ECART,
      now: MAINTENANT,
      plafonner: false,
    });
    assert.equal(cards.filter((c) => c.type === 'nouvelle_adresse').length, 0);
  });

  it('retire une carte ignorée définitivement', () => {
    const dismissals = new Map<string, string | null>([['relance:Oublié', null]]);
    const cards = buildTodayCards({
      leads: [],
      contacts: [contact('Oublié', { lastInteractionAt: joursAvant(10) })],
      rapprochements: [],
      dismissals,
      now: MAINTENANT,
      plafonner: false,
    });
    assert.equal(cards.length, 0);
  });

  it('fait réapparaître une carte reportée une fois la date passée', () => {
    const contacts = [contact('Oublié', { lastInteractionAt: joursAvant(10) })];

    const encoreReportee = new Map<string, string | null>([['relance:Oublié', joursAvant(-2)]]);
    assert.equal(
      buildTodayCards({
        leads: [],
        contacts,
        rapprochements: [],
        dismissals: encoreReportee,
        now: MAINTENANT,
      }).length,
      0,
    );

    const reportExpire = new Map<string, string | null>([['relance:Oublié', joursAvant(1)]]);
    assert.equal(
      buildTodayCards({
        leads: [],
        contacts,
        rapprochements: [],
        dismissals: reportExpire,
        now: MAINTENANT,
      }).length,
      1,
    );
  });
});

describe('summarizeTodayCards', () => {
  it('ne montre que les familles réellement présentes', () => {
    const cards = buildTodayCards({
      leads: [lead('a'), lead('b')],
      contacts: [contact('Oublié', { lastInteractionAt: joursAvant(10) })],
      rapprochements: [],
      dismissals: AUCUN_ECART,
      now: MAINTENANT,
      plafonner: false,
    });

    const groups = summarizeTodayCards(cards);
    assert.deepEqual(
      groups.map((g) => g.type),
      ['relance'],
    );
    assert.equal(groups[0]?.headline, '1 personne');
  });

  it('signale les relances en retard sans afficher de métrique nue', () => {
    const cards = buildTodayCards({
      leads: [],
      contacts: [
        contact('Vieux', { lastInteractionAt: joursAvant(60) }),
        contact('Récent', { lastInteractionAt: joursAvant(9) }),
      ],
      rapprochements: [],
      dismissals: AUCUN_ECART,
      now: MAINTENANT,
      plafonner: false,
    });

    const [relances] = summarizeTodayCards(cards);
    assert.equal(relances?.label, 'À rappeler');
    assert.equal(relances?.headline, '2 personnes');
    assert.equal(relances?.context, '1 attend depuis plus de trois semaines');
  });

  it('une relance datée dans le futur ne nague pas sur l’inactivité', () => {
    const cards = buildTodayCards({
      leads: [],
      contacts: [
        contact('PasAvant2028', {
          lastInteractionAt: joursAvant(60),
          recontacterLe: '2028-03-01',
        }),
      ],
      rapprochements: [],
      dismissals: AUCUN_ECART,
      now: MAINTENANT,
      plafonner: false,
    });
    assert.equal(cards.length, 0);
  });

  it('une date de relance arrivée produit une carte', () => {
    const cards = buildTodayCards({
      leads: [],
      contacts: [
        contact('ARelancer', {
          lastInteractionAt: joursAvant(1),
          recontacterLe: '2026-08-20',
        }),
      ],
      rapprochements: [],
      dismissals: AUCUN_ECART,
      now: MAINTENANT,
      plafonner: false,
    });
    assert.equal(cards.length, 1);
    assert.equal(cards[0]?.type, 'relance');
    assert.match(cards[0]?.context ?? '', /relancer|relance/i);
  });

  it('rend une liste vide quand il n’y a rien à faire', () => {
    assert.deepEqual(summarizeTodayCards([]), []);
  });

  it('place les signalements et les transmissions en tête', () => {
    const cards = buildTodayCards({
      leads: [],
      contacts: [],
      rapprochements: [],
      dismissals: AUCUN_ECART,
      now: MAINTENANT,
      plafonner: false,
      assignments: [
        {
          kind: 'contact',
          id: 'c1',
          assignedByName: 'Marie Curie',
          headline: 'Paul Martin',
          context: 'vendeur',
          contactId: 'c1',
          assignedAt: MAINTENANT.toISOString(),
        },
      ],
      alerts: [
        {
          id: 'a1',
          kind: 'baisse_prix',
          createdByName: 'Paul Martin',
          headline: 'Baisse de prix',
          context: 'Signalé par Paul Martin',
          contactId: 'c1',
          leadId: null,
        },
      ],
    });
    assert.equal(cards[0]?.type, 'alerte');
    assert.equal(cards[1]?.type, 'transmis');
    assert.match(cards[1]?.headline ?? '', /Marie Curie/);
    const groups = summarizeTodayCards(cards);
    assert.deepEqual(
      groups.map((g) => g.type),
      ['alerte', 'transmis'],
    );
  });
});

describe('estEcartee', () => {
  it('laisse passer une carte inconnue', () => {
    assert.equal(estEcartee('relance:x', AUCUN_ECART, MAINTENANT), false);
  });
});
