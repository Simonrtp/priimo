import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ParcelleLogement, ParcelleVente } from './parcelle';
import type { BatimentParcelle } from './bdnb';
import {
  decrireLogement,
  decrireVente,
  depuisQuand,
  logementsDistincts,
  decrireAudit,
  faitSci,
  pastillesEnteteParcelle,
  pourquoiSiPeu,
  prixDeLImmeuble,
  raccourcirUsage,
  syntheseParcelle,
  trierLogements,
} from './parcelle-synthese';

const MAINTENANT = new Date('2026-10-02T12:00:00Z');

/** Les descriptions portent des espaces insécables : on compare le texte à plat. */
const plat = (s: string) => s.replace(/ /g, ' ');

function logement(partiel: Partial<ParcelleLogement>): ParcelleLogement {
  return {
    banId: 'ban-1',
    date: '2022-03-01',
    etiquette: 'D',
    etiquetteGes: null,
    consoKwhM2: null,
    surface: 50,
    etage: 2,
    ...partiel,
  };
}

function vente(partiel: Partial<ParcelleVente>): ParcelleVente {
  return {
    date: '2025-06-01',
    prix: 500_000,
    surface: 50,
    prixM2: 10_000,
    typeLocal: 'Appartement',
    nombrePieces: 2,
    banId: 'ban-1',
    ...partiel,
  };
}

describe('logementsDistincts', () => {
  it('garde le DPE le plus récent d’un logement re-diagnostiqué', () => {
    const avant = logement({ date: '2019-01-10', etiquette: 'G', etage: 4, surface: 62.4 });
    const apres = logement({ date: '2024-05-02', etiquette: 'D', etage: 4, surface: 62.4 });
    const distincts = logementsDistincts([avant, apres]);
    assert.equal(distincts.length, 1);
    assert.equal(distincts[0]!.etiquette, 'D');
  });

  it('ne rapproche pas deux diagnostics sans étage ni surface', () => {
    const a = logement({ etage: null, surface: null, etiquette: 'G' });
    const b = logement({ etage: null, surface: null, etiquette: 'G' });
    assert.equal(logementsDistincts([a, b]).length, 2);
  });

  it('garde distincts deux logements jumeaux diagnostiqués le même jour', () => {
    const a = logement({ date: '2023-05-10', etage: 3, surface: 50, etiquette: 'D' });
    const b = logement({ date: '2023-05-10', etage: 3, surface: 50, etiquette: 'E' });
    assert.equal(logementsDistincts([a, b]).length, 2);
  });

  it('distingue deux logements du même étage aux surfaces différentes', () => {
    const gauche = logement({ etage: 3, surface: 45.2 });
    const droite = logement({ etage: 3, surface: 47.8 });
    assert.equal(logementsDistincts([gauche, droite]).length, 2);
  });
});

describe('trierLogements', () => {
  it('classe du plus récent au plus ancien', () => {
    const tries = trierLogements([
      logement({ etiquette: 'F', date: '2021-08-27' }),
      logement({ etiquette: 'E', date: '2025-11-19' }),
      logement({ etiquette: 'C', date: '2023-10-16' }),
      logement({ etiquette: null, date: null }),
    ]);
    assert.deepEqual(
      tries.map((l) => l.date),
      ['2025-11-19', '2023-10-16', '2021-08-27', null],
    );
  });
});

describe('descriptions', () => {
  it('décrit un logement par son étage et sa surface', () => {
    assert.equal(plat(decrireLogement({ etage: 4, surface: 62.4 })), '4e étage · 62 m²');
    assert.equal(decrireLogement({ etage: null, surface: null }), 'Logement');
  });

  it('décrit une vente en T et en m²', () => {
    assert.equal(plat(decrireVente({ typeLocal: 'Appartement', nombrePieces: 3, surface: 61.8 })), 'T3 · 62 m²');
    assert.equal(plat(decrireVente({ typeLocal: 'Maison', nombrePieces: 5, surface: 120 })), 'Maison 5 p. · 120 m²');
  });

  it('ne laisse jamais une unité seule en fin de ligne', () => {
    assert.ok(decrireLogement({ etage: 4, surface: 62 }).includes('62 m²'));
    assert.ok(decrireLogement({ etage: 4, surface: 62 }).startsWith('4e étage'));
  });

  it('dit depuis quand en mois puis en années', () => {
    assert.equal(depuisQuand('2026-10-01', MAINTENANT), 'ce mois-ci');
    assert.equal(depuisQuand('2026-06-15', MAINTENANT), 'il y a 4 mois');
    assert.equal(depuisQuand('2023-09-01', MAINTENANT), 'il y a 3 ans');
  });
});

describe('prixDeLImmeuble', () => {
  it('prend la médiane des trois dernières années quand il y a de quoi', () => {
    const prix = prixDeLImmeuble(
      [
        vente({ date: '2026-01-10', prixM2: 11_000 }),
        vente({ date: '2025-03-10', prixM2: 10_000 }),
        vente({ date: '2016-03-10', prixM2: 6_000 }),
      ],
      MAINTENANT,
    );
    assert.equal(prix?.valeur, 10_500);
    assert.equal(prix?.recent, true);
  });

  it('se rabat sur tout l’historique et dit depuis quand', () => {
    const prix = prixDeLImmeuble(
      [vente({ date: '2018-03-10', prixM2: 8_000 }), vente({ date: '2020-03-10', prixM2: 9_000 })],
      MAINTENANT,
    );
    assert.equal(prix?.recent, false);
    assert.equal(prix?.depuis, 2018);
  });

  it('écarte les prix aberrants et ne mélange pas maisons et appartements', () => {
    const prix = prixDeLImmeuble(
      [
        vente({ prixM2: 10_000 }),
        vente({ date: '2025-08-01', prixM2: 12_000 }),
        vente({ prixM2: 3, date: '2026-02-01' }),
        vente({ typeLocal: 'Maison', prixM2: 4_000 }),
      ],
      MAINTENANT,
    );
    assert.equal(prix?.valeur, 11_000);
  });
});

describe('syntheseParcelle', () => {
  it('résume passoires, ventes, prix et procédure dans cet ordre', () => {
    const s = syntheseParcelle(
      {
        ventes: [
          vente({ date: '2026-05-01', prixM2: 10_400 }),
          vente({ date: '2025-01-01', prixM2: 10_400 }),
          vente({ date: '2024-02-01', prixM2: 10_400 }),
        ],
        logements: [
          logement({ etiquette: 'G', etage: 4, surface: 62 }),
          logement({ etiquette: 'F', etage: 2, surface: 38 }),
          logement({ etiquette: 'C', etage: 1, surface: 70 }),
        ],
        coproprietes: [
          { lots: 12, periodeConstruction: '1919–1945', procedureEnCours: true, numeroImmatriculation: null },
        ],
        prixM2Secteur: 9_900,
      },
      MAINTENANT,
    );

    assert.deepEqual(
      s.faits.map((f) => f.cle),
      ['passoires', 'ventes', 'prix', 'procedure'],
    );
    assert.match(plat(s.faits[0]!.texte), /^2 logements classés F ou G : 4e étage · 62 m² \(G\)/);
    assert.equal(plat(s.faits[1]!.texte), '3 ventes en 3 ans pour 12 lots : un immeuble qui tourne');
    assert.match(plat(s.faits[2]!.texte), /secteur 9\s900 €\/m² \(\+5 %\)/);
    assert.deepEqual(
      s.pastilles.map((p) => p.cle),
      ['passoires', 'vente-recente', 'procedure', 'lots'],
    );
  });

  it('signale un DPE récent comme une vente qui se prépare', () => {
    const s = syntheseParcelle(
      {
        ventes: [],
        logements: [logement({ date: '2026-08-20', etage: 3, surface: 45 })],
        coproprietes: [],
        prixM2Secteur: null,
      },
      MAINTENANT,
    );
    assert.equal(s.dpeRecent?.date, '2026-08-20');
    assert.match(plat(s.faits[0]!.texte), /^DPE fait il y a 2 mois \(3e étage · 45 m²\)/);
  });

  it('lit l’absence de vente comme des propriétaires installés', () => {
    const s = syntheseParcelle(
      {
        ventes: [vente({ date: '2019-04-01' })],
        logements: [],
        coproprietes: [],
        prixM2Secteur: null,
      },
      MAINTENANT,
    );
    assert.equal(plat(s.faits[0]!.texte), 'Aucune vente depuis 2019 : des propriétaires installés de longue date');
  });

  it('ne dit rien quand il n’y a rien à dire', () => {
    const s = syntheseParcelle(
      { ventes: [], logements: [], coproprietes: [], prixM2Secteur: null },
      MAINTENANT,
    );
    assert.equal(s.faits.length, 0);
    assert.equal(s.pastilles.length, 0);
  });
});

describe('pourquoiSiPeu', () => {
  const batiment = (partiel: Partial<BatimentParcelle>): BatimentParcelle => ({
    nbBatiments: 1,
    empriseM2: 800,
    usage: 'Résidentiel collectif',
    anneeConstruction: 1930,
    niveaux: 6,
    logements: 40,
    materiaux: null,
    proprietaires: [],
    dpeRecents: 0,
    dpeRecentsFG: 0,
    dpeAnciens: 0,
    dpeAnciensFG: 0,
    dpeTertiaire: null,
    monumentHistorique: null,
    quartierPrioritaire: null,
    adressesBan: [],
    adressePrincipale: null,
    ...partiel,
  });
  const base = { ventes: 0, logements: 0, adresses: 1, surfaceM2: 1000, batimentConnu: true };

  it('ne dit rien quand ventes et DPE sont là', () => {
    assert.deepEqual(pourquoiSiPeu({ ...base, ventes: 2, logements: 3, batiment: batiment({}) }), []);
  });

  it('reconnaît un square : presque pas de bâti sur une grande parcelle', () => {
    const r = pourquoiSiPeu({ ...base, surfaceM2: 9874, batiment: batiment({ empriseM2: 95, logements: null, usage: null }) });
    assert.match(plat(r[0]!), /^Presque pas de bâti : 95 m² construits sur 9\s874 m²/);
  });

  it('nomme le propriétaire public ou le bailleur social', () => {
    const ville = pourquoiSiPeu({
      ...base,
      batiment: batiment({
        proprietaires: [{ nom: 'VILLE DE PARIS', siren: null, genre: 'public' }],
        usage: 'Tertiaire',
        logements: null,
      }),
    });
    assert.equal(ville[0], 'Propriété de Ville de Paris : bâtiment public, hors marché.');
    assert.match(ville[1]!, /^Usage tertiaire : ni DPE de logement/);
    const adoma = pourquoiSiPeu({
      ...base,
      batiment: batiment({ proprietaires: [{ nom: 'ADOMA', siren: null, genre: 'social' }] }),
    });
    assert.equal(adoma[0], 'Logements sociaux (Adoma) : ils ne se vendent presque jamais à l’unité.');
  });

  it('dit ce que couvrent les données pour un immeuble résidentiel calme', () => {
    const r = pourquoiSiPeu({ ...base, batiment: batiment({}) });
    assert.deepEqual(r, [
      'Aucun DPE depuis juillet 2021 : il n’est exigé qu’à la vente ou à la mise en location.',
      'Aucune vente d’appartement ni de maison depuis janvier 2021 : les données DVF couvrent cinq ans.',
    ]);
  });

  it('distingue une parcelle sans bâtiment d’une BDNB muette', () => {
    assert.match(pourquoiSiPeu({ ...base, adresses: 0, batiment: null })[0]!, /^Ni bâtiment ni adresse/);
    const muette = pourquoiSiPeu({ ...base, batiment: null, batimentConnu: false });
    assert.match(muette[0]!, /^Aucun DPE depuis juillet 2021/);
  });
});

describe('syntheseParcelle avec la BDNB', () => {
  it('ajoute SCI, anciennes passoires et ligne immeuble, sans pastille d’abords', () => {
    const s = syntheseParcelle(
      {
        ventes: [],
        logements: [],
        coproprietes: [],
        prixM2Secteur: null,
        batiment: {
          nbBatiments: 1,
          empriseM2: 1640,
          usage: 'Résidentiel collectif',
          anneeConstruction: 1928,
          niveaux: 8,
          logements: 268,
          materiaux: 'BETON',
          proprietaires: [
            { nom: 'SCI PREMIAN', siren: null, genre: 'sci' },
            { nom: 'SCI CYJO', siren: null, genre: 'sci' },
          ],
          dpeRecents: 0,
          dpeRecentsFG: 0,
          dpeAnciens: 9,
          dpeAnciensFG: 4,
          dpeTertiaire: null,
          monumentHistorique: { nom: 'palais de la femme', distanceM: 33 },
          quartierPrioritaire: null,
          adressesBan: [],
          adressePrincipale: null,
        },
        batimentConnu: true,
        adresses: 1,
      },
      MAINTENANT,
    );
    assert.equal(plat(s.immeuble!), 'Résidentiel collectif · construit en 1928 · 8 niveaux · 268 logements');
    assert.deepEqual(
      s.faits.map((f) => f.cle),
      ['sci', 'passoires-anciennes'],
    );
    assert.equal(plat(s.faits[0]!.texte), '2 SCI détiennent des lots ici : des investisseurs, joignables par leur gérant');
    assert.equal(s.pastilles.some((p) => p.cle === 'abf'), false);
  });
});

describe('pastillesEnteteParcelle', () => {
  it('raccourcit l’usage résidentiel', () => {
    assert.equal(raccourcirUsage('Résidentiel collectif'), 'Collectif');
    assert.equal(raccourcirUsage('Résidentiel individuel'), 'Individuel');
    assert.equal(raccourcirUsage('Tertiaire'), 'Tertiaire');
  });

  it('assemble une ligne dense sans la référence cadastrale', () => {
    const chips = pastillesEnteteParcelle({
      localite: '75020 Paris',
      surfaceM2: 442,
      batiment: {
        nbBatiments: 1,
        empriseM2: 200,
        usage: 'Résidentiel collectif',
        anneeConstruction: 1914,
        niveaux: 7,
        logements: 13,
        materiaux: null,
        proprietaires: [],
        dpeRecents: 0,
        dpeRecentsFG: 0,
        dpeAnciens: 0,
        dpeAnciensFG: 0,
        dpeTertiaire: null,
        monumentHistorique: null,
        quartierPrioritaire: null,
        adressesBan: [],
        adressePrincipale: null,
      },
    });
    assert.deepEqual(
      chips.map((c) => ({ cle: c.cle, libelle: plat(c.libelle) })),
      [
        { cle: 'localite', libelle: '75020 Paris' },
        { cle: 'surface', libelle: '442 m²' },
        { cle: 'usage', libelle: 'Collectif' },
        { cle: 'annee', libelle: '1914' },
        { cle: 'niveaux', libelle: '7 niv.' },
        { cle: 'logements', libelle: '13 log.' },
      ],
    );
  });
});

describe('pourquoiSiPeu, immeubles mixtes', () => {
  it('ne dit pas « tertiaire » d’un immeuble qui a des logements ou des DPE', () => {
    const b: BatimentParcelle = {
      nbBatiments: 1,
      empriseM2: 2000,
      usage: 'Tertiaire',
      anneeConstruction: 1993,
      niveaux: 4,
      logements: 168,
      materiaux: null,
      proprietaires: [],
      dpeRecents: 0,
      dpeRecentsFG: 0,
      dpeAnciens: 0,
      dpeAnciensFG: 0,
      dpeTertiaire: null,
      monumentHistorique: null,
      quartierPrioritaire: null,
      adressesBan: [],
      adressePrincipale: null,
    };
    const r = pourquoiSiPeu({ ventes: 0, logements: 493, adresses: 1, surfaceM2: null, batiment: b, batimentConnu: true });
    assert.ok(r.every((x) => !x.startsWith('Usage')));
  });
});

describe('faitSci', () => {
  const sci = (nom: string, nbLots: number, niveaux: number[] = []) => ({
    nom,
    siren: null,
    genre: 'sci' as const,
    nbLots,
    niveaux,
  });

  it('dit qu’une SCI ne détient qu’un lot, avec son étage', () => {
    assert.equal(
      faitSci([sci('SCI A', 1, [3])], true),
      'Une SCI détient un lot ici (3e étage) : un investisseur, joignable par son gérant',
    );
  });

  it('repère une SCI seule propriétaire sans copropriété : l’immeuble entier', () => {
    assert.match(
      faitSci([sci('SCI LES LILAS', 12, [0, 1, 2, 3])], false)!,
      /^SCI les Lilas est la seule propriétaire connue \(12 lots, aucune copropriété déclarée\)/,
    );
  });

  it('additionne les lots de plusieurs SCI', () => {
    assert.equal(
      faitSci([sci('SCI A', 1), sci('SCI B', 4)], true),
      '2 SCI détiennent 5 lots ici : des investisseurs, joignables par leur gérant',
    );
  });

  it('tait une SCI qui n’a qu’un parking ou une cave', () => {
    assert.equal(faitSci([sci('SCI PARKING', 1, [-1])], true), null);
    assert.equal(
      faitSci([sci('SCI PARKING', 2, [-1, -2]), sci('SCI B', 1, [4])], true),
      'Une SCI détient un lot ici (4e étage) : un investisseur, joignable par son gérant',
    );
  });

  it('ne dit pas « seule propriétaire » quand une autre SCI tient un parking', () => {
    assert.match(
      faitSci([sci('SCI LES LILAS', 12, [0, 1, 2]), sci('SCI PARKING', 1, [-1])], false)!,
      /^Une SCI détient 12 lots ici/,
    );
  });

  it('reste prudente sans le détail des lots (BDNB seule)', () => {
    assert.equal(
      faitSci([{ nom: 'SCI A', siren: null, genre: 'sci' }], true),
      '1 SCI détient des lots ici : un investisseur, joignable par son gérant',
    );
  });
});

describe('decrireAudit', () => {
  it('dit le logement, la classe et le gain possible', () => {
    const texte = decrireAudit(
      {
        numero: 'A1',
        date: '2026-07-01',
        banId: null,
        classeActuelle: 'F',
        classeVisee: 'A',
        typologie: 'T3',
        surface: 62.4,
        etage: 4,
      },
      MAINTENANT,
    );
    assert.equal(
      plat(texte),
      'Audit énergétique il y a 3 mois (T3 · 62 m² · 4e étage, F → A après travaux) : le propriétaire prépare une vente ou des travaux',
    );
  });
});
