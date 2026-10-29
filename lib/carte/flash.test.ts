import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Annonce, EvenementAnnonce } from '@/lib/annonces/types';
import type { DpeTournee } from '@/lib/tournee/generer';
import { flashDesAnnonces, flashDesDpe, ordreDuBandeau, quandFlash, rueDe, type FlashItem } from './flash';

const MAINTENANT = new Date('2026-10-29T12:00:00Z');
const partout = { dansLePerimetre: () => true, maintenant: MAINTENANT };

function dpe(over: Partial<DpeTournee> = {}): DpeTournee {
  return {
    numeroDpe: 'D1',
    banId: '75120_1234_00012',
    adresse: '12 Rue des Pyrénées 75020 Paris',
    codePostal: '75020',
    latitude: 48.86,
    longitude: 2.4,
    date: '2026-10-27',
    lettre: 'f',
    surfaceM2: 54,
    typeBatiment: null,
    parcelleId: null,
    ...over,
  };
}

function annonce(over: Partial<Annonce> = {}): Annonce {
  return {
    id: 'a1',
    idPortail: 'x',
    portail: 'pap',
    url: 'https://example.test/a1',
    typeVendeur: 'particulier',
    agenceNom: null,
    refusDemarchage: false,
    statut: 'active',
    publieeLe: '2026-10-27T10:00:00Z',
    premiereVueLe: '2026-10-27T10:00:00Z',
    derniereVueLe: '2026-10-28T10:00:00Z',
    retireeLe: null,
    typeBien: 'appartement',
    titre: null,
    prixInitial: 280_000,
    prix: 280_000,
    surface: 34,
    pieces: 2,
    etage: '5',
    dpe: 'F',
    codePostal: '75020',
    ville: 'Paris',
    quartier: null,
    confiance: 'sure',
    localisationPrecision: 'adresse',
    adresse: '58 Boulevard de Ménilmontant',
    adresseNumero: '58',
    adresseVoie: 'Boulevard de Ménilmontant',
    parcelleIds: ['75120000AB0012'],
    numeroDpe: null,
    complementDpe: null,
    latitude: 48.865,
    longitude: 2.385,
    logementCle: null,
    scoreLocalisation: null,
    raisonsLocalisation: [],
    ...over,
  } as Annonce;
}

function baisse(over: Partial<EvenementAnnonce> = {}): EvenementAnnonce {
  return {
    id: 'e1',
    annonceId: 'a1',
    type: 'baisse_prix',
    survenuLe: '2026-10-28T08:00:00Z',
    avant: { prix: 280_000 },
    apres: { prix: 265_000, variation_pct: -5.4 },
    createdAt: '2026-10-28T08:00:00Z',
    ...over,
  };
}

describe('flashDesDpe', () => {
  it('un immeuble, une nouvelle : plusieurs DPE se comptent, le plus récent donne la lettre', () => {
    const items = flashDesDpe(
      [
        dpe({ numeroDpe: 'D1', date: '2026-10-24', lettre: 'D' }),
        dpe({ numeroDpe: 'D2', date: '2026-10-27', lettre: 'g' }),
        dpe({ numeroDpe: 'D2', date: '2026-10-27', lettre: 'g' }),
      ],
      partout,
    );
    assert.equal(items.length, 1);
    assert.equal(items[0]!.nombre, 2);
    assert.equal(items[0]!.lettre, 'G');
    assert.equal(items[0]!.date, '2026-10-27');
    assert.equal(items[0]!.rue, '12 Rue des Pyrénées');
  });

  it('un DPE trop ancien ou hors du périmètre ne fait pas la une', () => {
    assert.equal(flashDesDpe([dpe({ date: '2026-08-01' })], partout).length, 0);
    assert.equal(
      flashDesDpe([dpe()], { dansLePerimetre: () => false, maintenant: MAINTENANT }).length,
      0,
    );
  });
});

describe('flashDesAnnonces', () => {
  it('une baisse vue par Priimo : la date et le pourcentage de l’événement', () => {
    const items = flashDesAnnonces([annonce({ prix: 265_000 })], [baisse()], partout);
    assert.equal(items.length, 1);
    assert.equal(items[0]!.type, 'baisse');
    assert.equal(items[0]!.pourcent, 5.4);
    assert.equal(items[0]!.date, '2026-10-28T08:00:00Z');
  });

  it('la baisse affichée par le portail avant le suivi n’est pas une nouvelle', () => {
    const items = flashDesAnnonces(
      [annonce({ publieeLe: '2026-09-01T00:00:00Z', premiereVueLe: '2026-10-10T00:00:00Z' })],
      [baisse({ survenuLe: '2026-10-01T00:00:00Z' })],
      partout,
    );
    assert.equal(items.length, 0);
  });

  it('une annonce de la semaine sans baisse : nouvelle annonce', () => {
    const items = flashDesAnnonces([annonce()], [], partout);
    assert.equal(items.length, 1);
    assert.equal(items[0]!.type, 'nouvelle');
    assert.equal(items[0]!.rue, '58 Boulevard de Ménilmontant');
  });

  it('le même logement sur deux portails ne compte qu’une fois', () => {
    const items = flashDesAnnonces(
      [annonce({ id: 'a1', logementCle: 'L1' }), annonce({ id: 'a2', portail: 'seloger', logementCle: 'L1' })],
      [],
      partout,
    );
    assert.equal(items.length, 1);
  });

  it('une annonce retirée ou ancienne sans baisse reste hors du flash', () => {
    assert.equal(flashDesAnnonces([annonce({ statut: 'retiree' })], [], partout).length, 0);
    assert.equal(
      flashDesAnnonces([annonce({ publieeLe: '2026-09-01T00:00:00Z', premiereVueLe: '2026-09-01T00:00:00Z' })], [], partout).length,
      0,
    );
  });
});

describe('la semaine', () => {
  it('DPE, baisse et nouvelle annonce : sept jours, pas un de plus', () => {
    // 29/10 midi : le 22 est à sept jours, le 21 à huit.
    assert.equal(flashDesDpe([dpe({ date: '2026-10-22' })], partout).length, 1);
    assert.equal(flashDesDpe([dpe({ date: '2026-10-21' })], partout).length, 0);

    const ancienne = { publieeLe: '2026-09-01T00:00:00Z', premiereVueLe: '2026-09-01T00:00:00Z' };
    const baisseLe = (jour: string) => [baisse({ survenuLe: `${jour}T08:00:00Z` })];
    assert.equal(flashDesAnnonces([annonce(ancienne)], baisseLe('2026-10-22'), partout).length, 1);
    assert.equal(flashDesAnnonces([annonce(ancienne)], baisseLe('2026-10-21'), partout).length, 0);

    const misEnLigne = (jour: string) => annonce({ publieeLe: `${jour}T10:00:00Z`, premiereVueLe: `${jour}T10:00:00Z` });
    assert.equal(flashDesAnnonces([misEnLigne('2026-10-22')], [], partout).length, 1);
    assert.equal(flashDesAnnonces([misEnLigne('2026-10-21')], [], partout).length, 0);
  });
});

describe('ordreDuBandeau', () => {
  it('chaque famille à son tour, le plus récent d’abord', () => {
    const item = (id: string, type: FlashItem['type'], date: string) => ({ id, type, date }) as FlashItem;
    const ordre = ordreDuBandeau([
      item('d1', 'dpe', '2026-10-20'),
      item('d2', 'dpe', '2026-10-27'),
      item('n1', 'nouvelle', '2026-10-26'),
      item('b1', 'baisse', '2026-10-25'),
    ]);
    assert.deepEqual(
      ordre.map((i) => i.id),
      ['d2', 'b1', 'n1', 'd1'],
    );
  });
});

describe('textes', () => {
  it('rue seule et date relative', () => {
    assert.equal(rueDe('12 Rue des Pyrénées 75020 Paris'), '12 Rue des Pyrénées');
    assert.equal(rueDe('3 rue Orfila'), '3 rue Orfila');
    assert.equal(quandFlash('2026-10-29T08:00:00Z', MAINTENANT), 'aujourd’hui');
    assert.equal(quandFlash('2026-10-28', MAINTENANT), 'hier');
    assert.equal(quandFlash('2026-10-25', MAINTENANT), 'il y a 4 j');
  });
});
