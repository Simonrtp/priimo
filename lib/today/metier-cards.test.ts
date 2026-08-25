import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildTodayCards, type TodayCard } from './cards';
import { plafonnerEtRegrouper, MAX_CARTES_AFFICHEES } from './cap-display';
import { scoreCarte } from './scoring';
import { cartesPostVisite } from './metier-cards';
import type { TodayVisite } from '@/types/metier';

function relanceCard(id: string, score: number): TodayCard {
  return {
    key: `relance:${id}`,
    type: 'relance',
    headline: id,
    context: 'test',
    action: { kind: 'ouvrir_contact', label: 'Ouvrir', contactId: id },
    enjeu: 40,
    imminence: score,
    score: scoreCarte(40, score),
    dismissible: true,
    priority: 0,
    urgent: false,
  };
}

describe('cartesPostVisite', () => {
  const now = new Date('2026-08-20T15:00:00.000Z');

  it('propose deux appels dans les 48h sans CR', () => {
    const visites: TodayVisite[] = [
      {
        id: 'v1',
        bienId: 'b1',
        bienAddress: '12 rue A',
        contactId: 'c1',
        contactName: 'M. Blanc',
        contactPhone: '0600000000',
        dateVisite: new Date(now.getTime() - 20 * 3_600_000).toISOString(),
        compteRenduAcquereurFaitLe: null,
        compteRenduVendeurFaitLe: null,
        proprietaireContactId: 'p1',
        proprietaireName: 'Mme Durand',
        proprietairePhone: '0700000000',
      },
    ];
    const cards = cartesPostVisite(visites, now);
    assert.equal(cards.length, 2);
    assert.ok(cards.every((c) => c.type === 'post_visite'));
  });

  it('masque au-delà de 72h', () => {
    const visites: TodayVisite[] = [
      {
        id: 'v1',
        bienId: 'b1',
        bienAddress: '12 rue A',
        contactId: 'c1',
        contactName: 'M. Blanc',
        contactPhone: null,
        dateVisite: new Date(now.getTime() - 80 * 3_600_000).toISOString(),
        compteRenduAcquereurFaitLe: null,
        compteRenduVendeurFaitLe: null,
        proprietaireContactId: null,
        proprietaireName: null,
        proprietairePhone: null,
      },
    ];
    assert.equal(cartesPostVisite(visites, now).length, 0);
  });
});

describe('plafonnerEtRegrouper', () => {
  it('ne dépasse pas 7 cartes', () => {
    const cards = Array.from({ length: 12 }, (_, i) => relanceCard(`c${i}`, 90 - i));
    const out = plafonnerEtRegrouper(cards);
    assert.ok(out.length <= MAX_CARTES_AFFICHEES + 1);
  });

  it('regroupe au-delà de 3 relances', () => {
    const cards = Array.from({ length: 6 }, (_, i) => relanceCard(`c${i}`, 80 - i));
    const out = plafonnerEtRegrouper(cards);
    assert.ok(out.some((c) => c.key === 'groupe:relance'));
  });
});

describe('tri enjeu × imminence', () => {
  const MAINTENANT = new Date('2026-08-20T09:00:00.000Z');

  it('place une échéance contractuelle avant une nouvelle adresse', () => {
    const cards = buildTodayCards({
      leads: [
        {
          id: 'l1',
          address: '1 rue Test',
          status: 'nouveau',
          score: 90,
          mainSignalLabel: null,
          propertyType: 'T2',
          surfaceM2: 50,
          deliveredAt: MAINTENANT.toISOString(),
          createdAt: MAINTENANT.toISOString(),
          latitude: null,
          longitude: null,
        },
      ],
      contacts: [],
      rapprochements: [],
      dismissals: new Map(),
      biensMetier: [
        {
          id: 'b1',
          address: '10 rue Mandat',
          mandatType: 'exclusif',
          mandatSigneLe: '2026-06-01',
          mandatDureeMois: 3,
          mandatStatut: 'mandat_exclusif',
          price: 300000,
          latitude: null,
          longitude: null,
          visitCount: 0,
        },
      ],
      now: MAINTENANT,
      plafonner: false,
    });
    assert.ok(cards.length >= 2);
    assert.equal(cards[0]?.type, 'echeance_contractuelle');
    assert.ok(cards[0]!.score > (cards.find((c) => c.type === 'nouvelle_adresse')?.score ?? 0));
  });
});
