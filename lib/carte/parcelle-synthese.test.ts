import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ParcelleLogement, ParcelleVente } from './parcelle';
import {
  decrireLogement,
  decrireVente,
  depuisQuand,
  logementsDistincts,
  prixDeLImmeuble,
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
    assert.equal(s.faits[1]!.texte, '3 ventes en 3 ans pour 12 lots : un immeuble qui tourne');
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
    assert.equal(s.faits[0]!.texte, 'Aucune vente depuis 2019 : des propriétaires installés de longue date');
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
