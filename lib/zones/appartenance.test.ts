import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  adresseDansZone,
  pointDansPolygone,
  specificiteDansZone,
  zoneDeLAdresse,
  zonesDeLAdresse,
} from './appartenance';
import { adresseAJuger } from './adresse';
import type { AdresseAJuger, RegleZone, ValeurPolygone, Zone } from './types';

/** Carré autour de (48.85, 2.40), sommets en [lng, lat]. */
const CARRE: ValeurPolygone = {
  type: 'Polygon',
  coordinates: [
    [
      [2.39, 48.84],
      [2.41, 48.84],
      [2.41, 48.86],
      [2.39, 48.86],
      [2.39, 48.84],
    ],
  ],
};

/** Même carré, avec un trou central. */
const CARRE_TROUE: ValeurPolygone = {
  type: 'Polygon',
  coordinates: [
    CARRE.coordinates[0]!,
    [
      [2.398, 48.848],
      [2.402, 48.848],
      [2.402, 48.852],
      [2.398, 48.852],
      [2.398, 48.848],
    ],
  ],
};

function zone(partiel: Partial<Zone> & { regles: RegleZone[] }): Zone {
  return {
    id: 'z1',
    agencyId: 'a1',
    nom: 'Zone test',
    couleur: '#4C7A9E',
    assignedTo: null,
    jourSemaine: null,
    actif: true,
    verrouillee: false,
    ...partiel,
  };
}

function regle(partiel: Partial<RegleZone> & Pick<RegleZone, 'type' | 'valeur'>): RegleZone {
  return {
    id: 'r1',
    zoneId: 'z1',
    inclusion: true,
    ...partiel,
  } as RegleZone;
}

const DEDANS: AdresseAJuger = {
  latitude: 48.85,
  longitude: 2.4,
  nomVoie: null,
  numero: null,
  codePostal: null,
  parcelleId: null,
};

describe('point dans polygone — sans PostGIS', () => {
  it('retient un point intérieur et rejette un point extérieur', () => {
    assert.equal(pointDansPolygone(DEDANS, CARRE), true);
    assert.equal(pointDansPolygone({ latitude: 48.9, longitude: 2.4 }, CARRE), false);
    assert.equal(pointDansPolygone({ latitude: 48.85, longitude: 2.5 }, CARRE), false);
  });

  it('ne place jamais une adresse sans coordonnées', () => {
    assert.equal(pointDansPolygone({ latitude: null, longitude: 2.4 }, CARRE), false);
    assert.equal(pointDansPolygone({ latitude: 48.85, longitude: null }, CARRE), false);
  });

  it('exclut les trous du contour', () => {
    // Le centre est dans le trou, un point décalé reste dans la zone.
    assert.equal(pointDansPolygone({ latitude: 48.85, longitude: 2.4 }, CARRE_TROUE), false);
    assert.equal(pointDansPolygone({ latitude: 48.843, longitude: 2.395 }, CARRE_TROUE), true);
  });

  it('refuse un contour dégénéré', () => {
    assert.equal(
      pointDansPolygone(DEDANS, {
        type: 'Polygon',
        coordinates: [[[2.39, 48.84], [2.41, 48.84]]],
      }),
      false,
    );
  });
});

describe('règles cumulatives', () => {
  it('retient une adresse dès qu’une inclusion correspond', () => {
    const z = zone({ regles: [regle({ type: 'polygone', valeur: CARRE })] });
    assert.equal(adresseDansZone(DEDANS, z), true);
  });

  it('laisse dehors une adresse qu’aucune règle ne réclame', () => {
    const z = zone({ regles: [regle({ type: 'code_postal', valeur: { code_postal: '75011' } })] });
    const adresse = adresseAJuger({ address: '1 Rue Robineau 75020 Paris' });
    assert.equal(zoneDeLAdresse(adresse, [z]), null);
  });

  it('ignore une zone désactivée', () => {
    const z = zone({ actif: false, regles: [regle({ type: 'polygone', valeur: CARRE })] });
    assert.equal(specificiteDansZone(DEDANS, z), null);
  });

  it('ignore une zone sans aucune règle', () => {
    assert.equal(specificiteDansZone(DEDANS, zone({ regles: [] })), null);
  });
});

describe('les exclusions l’emportent toujours', () => {
  it('retire une voie d’un polygone', () => {
    const z = zone({
      regles: [
        regle({ type: 'polygone', valeur: CARRE }),
        regle({
          id: 'r2',
          inclusion: false,
          type: 'voie',
          valeur: {
            nom_voie: 'Rue de Bagnolet',
            code_postal: '75020',
            parite: 'toutes',
            numero_min: null,
            numero_max: null,
          },
        }),
      ],
    });

    const bagnolet = adresseAJuger({
      address: '5 Rue de Bagnolet 75020 Paris',
      latitude: 48.85,
      longitude: 2.4,
    });
    const buzenval = adresseAJuger({
      address: '94 Rue de Buzenval 75020 Paris',
      latitude: 48.85,
      longitude: 2.4,
    });

    assert.equal(adresseDansZone(bagnolet, z), false);
    assert.equal(adresseDansZone(buzenval, z), true);
  });

  it('l’emporte même sur une inclusion plus spécifique', () => {
    const z = zone({
      regles: [
        regle({
          type: 'parcelles',
          valeur: { parcelle_ids: ['75120000AB0042'] },
        }),
        regle({
          id: 'r2',
          inclusion: false,
          type: 'code_postal',
          valeur: { code_postal: '75020' },
        }),
      ],
    });

    const adresse: AdresseAJuger = {
      ...DEDANS,
      codePostal: '75020',
      parcelleId: '75120000AB0042',
    };
    assert.equal(specificiteDansZone(adresse, z), null);
  });
});

describe('règle de voie — les deux côtés d’une rue', () => {
  const impairs = regle({
    type: 'voie',
    valeur: {
      nom_voie: 'Rue des Maraîchers',
      code_postal: '75020',
      parite: 'impaires',
      numero_min: null,
      numero_max: null,
    },
  });

  it('sépare les numéros impairs des pairs', () => {
    const z = zone({ regles: [impairs] });
    assert.equal(
      adresseDansZone(adresseAJuger({ address: '15 Rue des Maraîchers 75020 Paris' }), z),
      true,
    );
    assert.equal(
      adresseDansZone(adresseAJuger({ address: '16 Rue des Maraîchers 75020 Paris' }), z),
      false,
    );
  });

  it('tient une plage de numéros, bornes incluses', () => {
    const z = zone({
      regles: [
        regle({
          type: 'voie',
          valeur: {
            nom_voie: 'Rue des Maraîchers',
            code_postal: '75020',
            parite: 'toutes',
            numero_min: 10,
            numero_max: 20,
          },
        }),
      ],
    });
    const dans = (n: number) =>
      adresseDansZone(adresseAJuger({ address: `${n} Rue des Maraîchers 75020 Paris` }), z);

    assert.equal(dans(9), false);
    assert.equal(dans(10), true);
    assert.equal(dans(20), true);
    assert.equal(dans(21), false);
  });

  it('ne s’applique pas sans numéro connu quand elle contraint la parité', () => {
    const z = zone({ regles: [impairs] });
    const sansNumero = adresseAJuger({ address: 'Rue des Maraîchers 75020 Paris' });
    assert.equal(adresseDansZone(sansNumero, z), false);
  });

  it('s’applique sans numéro quand elle ne contraint rien d’autre', () => {
    const z = zone({
      regles: [
        regle({
          type: 'voie',
          valeur: {
            nom_voie: 'Rue des Maraîchers',
            code_postal: '75020',
            parite: 'toutes',
            numero_min: null,
            numero_max: null,
          },
        }),
      ],
    });
    assert.equal(
      adresseDansZone(adresseAJuger({ address: 'Rue des Maraîchers 75020 Paris' }), z),
      true,
    );
  });

  it('exige le bon code postal', () => {
    const z = zone({ regles: [impairs] });
    assert.equal(
      adresseDansZone(adresseAJuger({ address: '15 Rue des Maraîchers 93100 Montreuil' }), z),
      false,
    );
  });
});

describe('la plus spécifique gagne', () => {
  const adresse = adresseAJuger({
    address: '15 Rue des Maraîchers 75020 Paris',
    latitude: 48.85,
    longitude: 2.4,
  });

  const parCodePostal = zone({
    id: 'cp',
    nom: 'Tout le 20e',
    regles: [regle({ zoneId: 'cp', type: 'code_postal', valeur: { code_postal: '75020' } })],
  });
  const parPolygone = zone({
    id: 'poly',
    nom: 'Quartier Est',
    regles: [regle({ zoneId: 'poly', type: 'polygone', valeur: CARRE })],
  });
  const parVoie = zone({
    id: 'voie',
    nom: 'Maraîchers impairs',
    regles: [
      regle({
        zoneId: 'voie',
        type: 'voie',
        valeur: {
          nom_voie: 'Rue des Maraîchers',
          code_postal: '75020',
          parite: 'impaires',
          numero_min: null,
          numero_max: null,
        },
      }),
    ],
  });

  it('fait primer la voie sur le polygone et le polygone sur le code postal', () => {
    assert.equal(zoneDeLAdresse(adresse, [parCodePostal, parPolygone, parVoie])?.id, 'voie');
    assert.equal(zoneDeLAdresse(adresse, [parCodePostal, parPolygone])?.id, 'poly');
    assert.equal(zoneDeLAdresse(adresse, [parCodePostal])?.id, 'cp');
  });

  it('ne dépend pas de l’ordre des zones', () => {
    assert.equal(zoneDeLAdresse(adresse, [parVoie, parPolygone, parCodePostal])?.id, 'voie');
  });

  it('expose tous les prétendants, du plus précis au moins précis', () => {
    const toutes = zonesDeLAdresse(adresse, [parCodePostal, parVoie, parPolygone]);
    assert.deepEqual(
      toutes.map((z) => z.id),
      ['voie', 'poly', 'cp'],
    );
  });

  it('à spécificité égale, garde la première zone donnée', () => {
    const autrePolygone = zone({
      id: 'poly2',
      regles: [regle({ zoneId: 'poly2', type: 'polygone', valeur: CARRE })],
    });
    assert.equal(zoneDeLAdresse(adresse, [parPolygone, autrePolygone])?.id, 'poly');
    assert.equal(zoneDeLAdresse(adresse, [autrePolygone, parPolygone])?.id, 'poly2');
    // Deux zones au même niveau : c'est un chevauchement à signaler.
    assert.equal(zonesDeLAdresse(adresse, [parPolygone, autrePolygone]).length, 2);
  });
});

describe('hors secteur attribué', () => {
  it('est un état normal, pas une erreur', () => {
    const z = zone({ regles: [regle({ type: 'polygone', valeur: CARRE })] });
    const ailleurs = adresseAJuger({
      address: '1 Rue de Lyon 69003 Lyon',
      latitude: 45.75,
      longitude: 4.85,
    });
    assert.equal(zoneDeLAdresse(ailleurs, [z]), null);
    assert.deepEqual(zonesDeLAdresse(ailleurs, [z]), []);
  });

  it('laisse un lead non géocodé hors zone plutôt que de le placer au hasard', () => {
    const z = zone({ regles: [regle({ type: 'polygone', valeur: CARRE })] });
    const sansCoords = adresseAJuger({ address: 'Adresse inconnue' });
    assert.equal(zoneDeLAdresse(sansCoords, [z]), null);
  });
});
