import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Zone } from '@/lib/zones/types';
import {
  adresseDansSecteur,
  adresseLibre,
  dejaProspectee,
  derniersPassagesAgence,
  dureeTourneeMinutes,
  genererTournee,
  raisonArret,
  regrouperAdresses,
  secteurDeTournee,
  valeurAdresse,
  versArretSortie,
  type AdresseTournee,
  type DpeTournee,
} from './generer';

const MAINTENANT = new Date('2026-10-05T10:00:00+02:00');
const MOI = 'agent-moi';
const COLLEGUE = 'agent-collegue';

/** Autour de 48.86, 2.34 — 0.001° de latitude ≈ 111 m. */
function dpe(banId: string, dLat: number, dLng: number, date: string, extra: Partial<DpeTournee> = {}): DpeTournee {
  return {
    numeroDpe: `${banId}-${date}`,
    banId,
    adresse: `${banId} rue de Test 75011 Paris`,
    codePostal: '75011',
    latitude: 48.86 + dLat,
    longitude: 2.34 + dLng,
    date,
    lettre: 'D',
    surfaceM2: 50,
    typeBatiment: 'appartement',
    parcelleId: null,
    ...extra,
  };
}

function adresses(dpes: DpeTournee[], passages: Map<string, string> = new Map()): AdresseTournee[] {
  return regrouperAdresses({ dpes, leads: [], passages });
}

function zone(id: string, assignedTo: string | null, carre: [number, number, number, number]): Zone {
  const [ouest, sud, est, nord] = carre;
  return {
    id,
    agencyId: 'agence',
    nom: `Secteur ${id}`,
    couleur: '#4F46E5',
    assignedTo,
    joursSemaine: [],
    actif: true,
    verrouillee: false,
    regles: [
      {
        id: `${id}-r`,
        zoneId: id,
        inclusion: true,
        type: 'polygone',
        valeur: {
          type: 'Polygon',
          coordinates: [
            [
              [ouest, sud],
              [est, sud],
              [est, nord],
              [ouest, nord],
              [ouest, sud],
            ],
          ],
        },
      },
    ],
  };
}

describe('regrouperAdresses', () => {
  it('compte les DPE par immeuble et garde le plus récent pour le décrire', () => {
    const [a] = adresses([
      dpe('a', 0, 0, '2026-08-01', { lettre: 'G' }),
      dpe('a', 0, 0, '2026-09-20', { lettre: 'c' }),
      dpe('a', 0, 0, '2026-09-20', { lettre: 'c' }),
    ]);
    assert.equal(a?.nbDpe, 2);
    assert.equal(a?.dernierDpe, '2026-09-20');
    assert.equal(a?.lettre, 'C');
    assert.equal(a?.passoire, true);
  });

  it("rattache le lead à l'immeuble du DPE et note le dernier passage", () => {
    const [a] = regrouperAdresses({
      dpes: [dpe('a', 0, 0, '2026-09-20')],
      leads: [
        {
          id: 'lead-1',
          banId: 'a',
          adresse: 'a rue de Test',
          codePostal: '75011',
          latitude: 48.86,
          longitude: 2.34,
          score: 72,
          signal: 'Détention longue',
          dpeDate: '2025-01-10',
          dpeLettre: 'F',
          surfaceM2: 40,
        },
      ],
      passages: new Map([['a', '2026-09-01']]),
    });
    assert.equal(a?.leadId, 'lead-1');
    assert.equal(a?.dernierDpe, '2026-09-20');
    assert.equal(a?.dernierPassage, '2026-09-01');
  });

  it('garde le passage le plus récent, tous collaborateurs confondus', () => {
    const passages = derniersPassagesAgence([
      { banId: 'a', profileId: MOI, jour: '2026-08-01' },
      { banId: 'a', profileId: COLLEGUE, jour: '2026-09-12' },
    ]);
    assert.equal(passages.get('a'), '2026-09-12');
  });
});

describe('dejaProspectee', () => {
  const base = adresses([dpe('a', 0, 0, '2026-09-10')])[0]!;

  it("une adresse jamais vue n'est pas faite", () => {
    assert.equal(dejaProspectee(base, MAINTENANT), false);
  });

  it('un passage depuis le dernier DPE la rend faite', () => {
    assert.equal(dejaProspectee({ ...base, dernierPassage: '2026-09-15' }, MAINTENANT), true);
  });

  it('un DPE arrivé après le passage la rouvre', () => {
    assert.equal(dejaProspectee({ ...base, dernierPassage: '2026-08-20' }, MAINTENANT), false);
  });

  it('un passage dans la semaine suffit, même avant le DPE', () => {
    assert.equal(
      dejaProspectee({ ...base, dernierDpe: '2026-10-04', dernierPassage: '2026-10-02' }, MAINTENANT),
      true,
    );
  });
});

describe('valeurAdresse', () => {
  it('un DPE frais vaut plus qu’un DPE de quatre mois', () => {
    const [frais, vieux] = adresses([dpe('a', 0, 0, '2026-10-01'), dpe('b', 0, 0, '2026-06-01')]);
    assert.ok(valeurAdresse(frais!, MAINTENANT) > 3 * valeurAdresse(vieux!, MAINTENANT));
  });

  it('une passoire passe devant à date égale', () => {
    const [passoire, autre] = adresses([
      dpe('a', 0, 0, '2026-09-20', { lettre: 'G' }),
      dpe('b', 0, 0, '2026-09-20', { lettre: 'C' }),
    ]);
    assert.ok(valeurAdresse(passoire!, MAINTENANT) > valeurAdresse(autre!, MAINTENANT));
  });

  it("un lead au vieux DPE garde une valeur, sous celle d'un DPE frais", () => {
    const [lead] = regrouperAdresses({
      dpes: [],
      leads: [
        {
          id: 'lead-1',
          banId: 'l',
          adresse: 'l rue de Test',
          codePostal: '75011',
          latitude: 48.86,
          longitude: 2.34,
          score: 50,
          signal: null,
          dpeDate: '2024-06-01',
          dpeLettre: 'E',
          surfaceM2: 40,
        },
      ],
      passages: new Map(),
    });
    const [frais] = adresses([dpe('a', 0, 0, '2026-09-28')]);
    const valeurLead = valeurAdresse(lead!, MAINTENANT);
    assert.ok(valeurLead > 0);
    assert.ok(valeurLead < valeurAdresse(frais!, MAINTENANT));
  });
});

describe('genererTournee', () => {
  it('rend une tournée vide sans adresse', () => {
    const t = genererTournee({
      adresses: [],
      ancres: [],
      position: null,
      agence: null,
      budgetMinutes: 60,
      maintenant: MAINTENANT,
    });
    assert.deepEqual(t.arrets, []);
    assert.equal(t.depart, null);
  });

  it('tient dans le temps donné, portes comprises', () => {
    const dpes = Array.from({ length: 30 }, (_, i) =>
      dpe(`p${i}`, (i % 6) * 0.0006, Math.floor(i / 6) * 0.0008, '2026-09-25'),
    );
    const position = { latitude: 48.86, longitude: 2.34 };
    const t = genererTournee({
      adresses: adresses(dpes),
      ancres: [],
      position,
      agence: null,
      budgetMinutes: 30,
      maintenant: MAINTENANT,
    });
    assert.equal(t.departSource, 'position');
    assert.ok(t.arrets.length >= 3, `${t.arrets.length} arrêts`);
    assert.ok(t.minutes <= 30, `${t.minutes} min`);
    assert.ok(Math.abs(dureeTourneeMinutes(t.arrets, t.depart) - t.minutes) < 1e-6);
  });

  it('plus de temps, plus de portes, sans dépasser le plafond', () => {
    const dpes = Array.from({ length: 60 }, (_, i) =>
      dpe(`p${i}`, (i % 8) * 0.0005, Math.floor(i / 8) * 0.0007, '2026-09-25'),
    );
    const commun = {
      adresses: adresses(dpes),
      ancres: [],
      position: { latitude: 48.86, longitude: 2.34 },
      agence: null,
      maintenant: MAINTENANT,
    };
    const court = genererTournee({ ...commun, budgetMinutes: 30 });
    const long = genererTournee({ ...commun, budgetMinutes: 180 });
    assert.ok(long.arrets.length > court.arrets.length);
    assert.ok(long.arrets.length <= 20);
  });

  it('préfère les DPE les plus récents à distance égale', () => {
    const dpes = [
      ...Array.from({ length: 6 }, (_, i) => dpe(`vieux${i}`, 0.001, i * 0.0004, '2026-04-20')),
      ...Array.from({ length: 6 }, (_, i) => dpe(`frais${i}`, -0.001, i * 0.0004, '2026-09-28')),
    ];
    const t = genererTournee({
      adresses: adresses(dpes),
      ancres: [],
      position: { latitude: 48.86, longitude: 2.341 },
      agence: null,
      budgetMinutes: 30,
      maintenant: MAINTENANT,
    });
    const frais = t.arrets.filter((a) => a.banId?.startsWith('frais')).length;
    const vieux = t.arrets.filter((a) => a.banId?.startsWith('vieux')).length;
    assert.ok(frais > vieux, `${frais} frais contre ${vieux} vieux`);
  });

  it("passe toujours par l'adresse imposée, même sans DPE", () => {
    const ancre = adresseLibre({
      label: '1 place du Choix 75011 Paris',
      latitude: 48.861,
      longitude: 2.341,
      banId: 'choix',
      codePostal: '75011',
    });
    const t = genererTournee({
      adresses: adresses([dpe('a', 0.001, 0.001, '2026-09-28'), dpe('b', 0.0012, 0.0008, '2026-09-27')]),
      ancres: [ancre],
      position: null,
      agence: null,
      budgetMinutes: 60,
      maintenant: MAINTENANT,
    });
    assert.equal(t.departSource, 'ancre');
    assert.ok(t.arrets.some((a) => a.key === ancre.key));
    assert.equal(t.arrets.length, 3);
  });

  it("part de l'agent quand il est déjà près de l'adresse imposée", () => {
    const ancre = adresseLibre({
      label: '1 place du Choix',
      latitude: 48.861,
      longitude: 2.341,
      banId: 'choix',
      codePostal: '75011',
    });
    const t = genererTournee({
      adresses: [],
      ancres: [ancre],
      position: { latitude: 48.862, longitude: 2.342 },
      agence: null,
      budgetMinutes: 60,
      maintenant: MAINTENANT,
    });
    assert.equal(t.departSource, 'position');
    assert.deepEqual(t.arrets.map((a) => a.key), [ancre.key]);
  });

  it("sans point de départ proche, va dans le coin le plus riche en DPE frais", () => {
    const riche = Array.from({ length: 8 }, (_, i) => dpe(`riche${i}`, 0.02 + i * 0.0003, 0.02, '2026-09-28'));
    const isole = [dpe('isole', -0.02, -0.02, '2026-10-02')];
    const t = genererTournee({
      adresses: adresses([...riche, ...isole]),
      ancres: [],
      position: { latitude: 48.70, longitude: 2.10 },
      agence: { latitude: 48.71, longitude: 2.11 },
      budgetMinutes: 60,
      maintenant: MAINTENANT,
    });
    assert.equal(t.departSource, 'secteur');
    assert.ok(t.arrets.length >= 6);
    assert.ok(t.arrets.every((a) => a.banId?.startsWith('riche')));
  });

  it('loin de tout, préfère le coin proche de l’agent à un coin à peine plus riche au bout de la ville', () => {
    const proche = Array.from({ length: 6 }, (_, i) => dpe(`proche${i}`, 0.0225 + i * 0.0003, 0, '2026-09-25'));
    const loin = Array.from({ length: 7 }, (_, i) => dpe(`loin${i}`, 0.135 + i * 0.0003, 0, '2026-09-25'));
    const t = genererTournee({
      adresses: adresses([...proche, ...loin]),
      ancres: [],
      position: { latitude: 48.86, longitude: 2.34 },
      agence: null,
      budgetMinutes: 60,
      maintenant: MAINTENANT,
    });
    assert.ok(t.arrets.every((a) => a.banId?.startsWith('proche')));
    assert.ok(t.distanceDepartM !== null && t.distanceDepartM > 2_000 && t.distanceDepartM < 3_000);
  });

  it('passe par toutes les adresses ajoutées', () => {
    const ancres = [0, 1, 2].map((i) =>
      adresseLibre({
        label: `${i} place du Choix`,
        latitude: 48.86 + i * 0.001,
        longitude: 2.341,
        banId: `choix${i}`,
        codePostal: '75011',
      }),
    );
    const t = genererTournee({
      adresses: adresses([dpe('a', 0.0005, 0.0005, '2026-09-28')]),
      ancres,
      position: { latitude: 48.86, longitude: 2.34 },
      agence: null,
      budgetMinutes: 60,
      maintenant: MAINTENANT,
    });
    assert.equal(t.departSource, 'position');
    assert.equal(t.distanceDepartM, null);
    for (const ancre of ancres) assert.ok(t.arrets.some((a) => a.key === ancre.key));
  });

  it("sans localisation, part de l'agence quand elle est dans le coin", () => {
    const t = genererTournee({
      adresses: adresses([dpe('a', 0.001, 0, '2026-09-28'), dpe('b', 0.0015, 0.0005, '2026-09-27')]),
      ancres: [],
      position: null,
      agence: { latitude: 48.86, longitude: 2.34 },
      budgetMinutes: 30,
      maintenant: MAINTENANT,
    });
    assert.equal(t.departSource, 'agence');
    assert.equal(t.distanceDepartM, null);
    assert.equal(t.arrets.length, 2);
  });
});

describe('secteur', () => {
  const mien = zone('mien', MOI, [2.33, 48.85, 2.35, 48.87]);
  const sien = zone('sien', COLLEGUE, [2.35, 48.85, 2.37, 48.87]);

  it('garde le secteur choisi sur la carte quand il est à l’agent', () => {
    const s = secteurDeTournee({ zones: [mien, sien], profileId: MOI, directeur: false, zoneId: 'mien' });
    assert.equal(s?.id, 'mien');
  });

  it("refuse le secteur d'un collègue et retombe sur le sien", () => {
    const s = secteurDeTournee({ zones: [mien, sien], profileId: MOI, directeur: false, zoneId: 'sien' });
    assert.equal(s?.id, 'mien');
  });

  it("ne garde que les adresses du secteur de l'agent", () => {
    const [dedans, dehors] = adresses([dpe('in', 0, 0, '2026-09-28'), dpe('out', 0, 0.02, '2026-09-28')]);
    const ctx = {
      secteur: mien,
      zones: [mien, sien],
      profileId: MOI,
      directeur: false,
      codesPostaux: new Set(['75011']),
      exclureCollegues: true,
    };
    assert.equal(adresseDansSecteur(dedans!, ctx), true);
    assert.equal(adresseDansSecteur(dehors!, ctx), false);
  });

  it("sans secteur, écarte celui d'un collègue mais garde le reste du territoire", () => {
    const [libre, collegue, horsTerritoire] = adresses([
      dpe('libre', 0.03, 0, '2026-09-28'),
      dpe('collegue', 0, 0.02, '2026-09-28'),
      dpe('ailleurs', 0, 0, '2026-09-28', { codePostal: '92100' }),
    ]);
    const ctx = {
      secteur: null,
      zones: [sien],
      profileId: MOI,
      directeur: false,
      codesPostaux: new Set(['75011']),
      exclureCollegues: true,
    };
    assert.equal(adresseDansSecteur(libre!, ctx), true);
    assert.equal(adresseDansSecteur(collegue!, ctx), false);
    assert.equal(adresseDansSecteur(horsTerritoire!, ctx), false);
  });

  it('tout le code postal, secteurs des collègues compris, quand l’agent le choisit', () => {
    const [collegue] = adresses([dpe('collegue', 0, 0.02, '2026-09-28')]);
    const ctx = {
      secteur: null,
      zones: [sien],
      profileId: MOI,
      directeur: false,
      codesPostaux: new Set(['75011']),
      exclureCollegues: false,
    };
    assert.equal(adresseDansSecteur(collegue!, ctx), true);
  });
});

describe('raisonArret', () => {
  it('dit le DPE et son âge', () => {
    const [a] = adresses([dpe('a', 0, 0, '2026-10-02', { lettre: 'F' })]);
    assert.equal(raisonArret(a!, MAINTENANT), 'DPE F il y a 3 jours');
  });

  it('compte les DPE de l’immeuble', () => {
    const [a] = adresses([dpe('a', 0, 0, '2026-09-21'), dpe('a', 0, 0, '2026-08-02')]);
    assert.equal(raisonArret(a!, MAINTENANT), '2 DPE, le dernier il y a 2 semaines');
  });

  it('détaille la porte rouverte par un DPE arrivé après le passage', () => {
    const [a] = adresses(
      [dpe('a', 0, 0, '2026-09-21', { lettre: 'G', surfaceM2: 42 }), dpe('a', 0, 0, '2026-08-02')],
      new Map([['a', '2026-09-01']]),
    );
    assert.deepEqual(versArretSortie(a!, MAINTENANT).detail, {
      dpe: { lettre: 'G', date: '2026-09-21', nombre: 2, passoire: true, surfaceM2: 42, type: 'appartement' },
      lead: null,
      dernierPassage: '2026-09-01',
      choisie: false,
    });
  });

  it("présente l'adresse imposée sans DPE", () => {
    const ancre = adresseLibre({ label: 'x', latitude: 48.86, longitude: 2.34, banId: null, codePostal: null });
    assert.equal(versArretSortie(ancre, MAINTENANT, { choisie: true }).mainSignalLabel, 'Adresse ajoutée');
  });
});
