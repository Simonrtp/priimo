import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  cartesDecrochage,
  cartesEstimationSansRelance,
  cartesMandatFinValidite,
  cartesMandatVieillit,
  carteProspectsSansNegociateur,
  construireCartesDirecteur,
  plafonnerCartesDirecteur,
  trierCartesDirecteur,
} from './cartes';

const NOW = new Date('2026-09-26T12:00:00.000Z');

describe('cartesDecrochage', () => {
  it('n’alerte pas sans 4 semaines d’historique', () => {
    const cartes = cartesDecrochage([
      {
        membreId: 'a',
        prenom: 'Léa',
        activite7j: 0,
        joursSansActivite: 10,
        moyenneHebdo4s: 12,
        semainesHistorique: 2,
      },
    ]);
    assert.equal(cartes.length, 0);
  });

  it('alerte sous 50 % de la moyenne', () => {
    const cartes = cartesDecrochage([
      {
        membreId: 'a',
        prenom: 'Léa',
        activite7j: 2,
        joursSansActivite: 5,
        moyenneHebdo4s: 10,
        semainesHistorique: 4,
      },
    ]);
    assert.equal(cartes.length, 1);
    assert.match(cartes[0]!.texte, /ne note plus rien depuis 5 jours/);
    assert.match(cartes[0]!.repere!, /contre 10 par semaine/);
  });

  it('formule la baisse en pourcentage si l’activité n’est pas nulle', () => {
    const cartes = cartesDecrochage([
      {
        membreId: 'b',
        prenom: 'Marc',
        activite7j: 3,
        joursSansActivite: 1,
        moyenneHebdo4s: 10,
        semainesHistorique: 4,
      },
    ]);
    assert.equal(cartes.length, 1);
    assert.match(cartes[0]!.texte, /baissé de 70 %/);
  });
});

describe('cartesEstimationSansRelance', () => {
  it('ignore les envois de moins de 7 jours', () => {
    assert.equal(
      cartesEstimationSansRelance([
        {
          id: 'e1',
          membreId: 'a',
          prenom: 'Léa',
          clientLabel: 'M. Leroy',
          envoyeIlYaJours: 3,
          consulteIlYaJours: 1,
        },
      ]).length,
      0,
    );
  });

  it('précise la consultation client', () => {
    const [carte] = cartesEstimationSansRelance([
      {
        id: 'e1',
        membreId: 'a',
        prenom: 'Léa',
        clientLabel: 'M. Leroy',
        envoyeIlYaJours: 10,
        consulteIlYaJours: 3,
      },
    ]);
    assert.match(carte!.texte, /consulté l'avis de valeur il y a 3 jours/);
  });
});

describe('cartesMandatFinValidite', () => {
  it('signale une échéance dans les 30 jours', () => {
    const cartes = cartesMandatFinValidite(
      [
        {
          id: 'b1',
          address: '12 rue Test',
          membreId: 'a',
          prenom: 'Léa',
          mandatSigneLe: '2026-07-10',
          mandatDureeMois: 3,
          visitCount: 5,
        },
      ],
      NOW,
    );
    assert.equal(cartes.length, 1);
    assert.equal(cartes[0]!.type, 'mandat_fin_validite');
  });
});

describe('cartesMandatVieillit', () => {
  it('signale un mandat > 60 j avec moins de 3 visites', () => {
    const cartes = cartesMandatVieillit(
      [
        {
          id: 'b2',
          address: '5 av. Vieille',
          membreId: 'a',
          prenom: 'Léa',
          mandatSigneLe: '2026-06-01',
          mandatDureeMois: 12,
          visitCount: 1,
        },
      ],
      NOW,
    );
    assert.equal(cartes.length, 1);
    assert.equal(cartes[0]!.type, 'mandat_vieillit');
  });

  it('ignore si assez de visites', () => {
    assert.equal(
      cartesMandatVieillit(
        [
          {
            id: 'b3',
            address: 'ok',
            membreId: null,
            prenom: null,
            mandatSigneLe: '2026-06-01',
            mandatDureeMois: 12,
            visitCount: 3,
          },
        ],
        NOW,
      ).length,
      0,
    );
  });
});

describe('carteProspectsSansNegociateur', () => {
  it('produit une carte Assigner', () => {
    const [carte] = carteProspectsSansNegociateur({ count: 4 });
    assert.equal(carte!.action, 'assigner');
    assert.match(carte!.texte, /4 prospects/);
  });
});

describe('trierCartesDirecteur', () => {
  it('ordonne par type puis score', () => {
    const triees = trierCartesDirecteur(
      construireCartesDirecteur({
        activites: [
          {
            membreId: 'a',
            prenom: 'Léa',
            activite7j: 0,
            joursSansActivite: 8,
            moyenneHebdo4s: 10,
            semainesHistorique: 4,
          },
        ],
        estimations: [],
        mandats: [
          {
            id: 'b1',
            address: 'Fin',
            membreId: 'a',
            prenom: 'Léa',
            mandatSigneLe: '2026-07-10',
            mandatDureeMois: 3,
            visitCount: 0,
          },
        ],
        prospectsSansNegociateur: 2,
        now: NOW,
      }),
    );
    assert.equal(triees[0]!.type, 'mandat_fin_validite');
    assert.ok(triees.some((c) => c.type === 'decrochage'));
    assert.equal(triees.at(-1)!.type, 'prospects_sans_negociateur');
  });
});

describe('plafonnerCartesDirecteur', () => {
  it('garde 4 cartes et compte le reste', () => {
    const { visibles, reste } = plafonnerCartesDirecteur(
      Array.from({ length: 7 }, (_, i) => ({
        key: `k${i}`,
        type: 'decrochage' as const,
        membreId: null,
        prenom: null,
        texte: `t${i}`,
        repere: null,
        action: 'preparer' as const,
        href: null,
        enjeu: 80,
        imminence: 50,
        score: 4000 - i,
      })),
    );
    assert.equal(visibles.length, 4);
    assert.equal(reste, 3);
  });
});
