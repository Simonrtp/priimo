import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { entonnoirCohorte, entonnoirVide } from './entonnoir';
import { RANGS_CANONIQUES, type TransitionRow } from './derive';
import {
  fractionEcoulee,
  phrasePilotage,
  rythmeRequis,
  SEMAINES_PAR_MOIS,
  type EntreePhrase,
} from './phrase';
import type { Ratios } from './ratios';
import { intervalleDe, semaineDe } from './semaines';
import { ACTIVITES, compteurVide, type Activite, type EtatSource } from './types';

/** Par défaut toutes les sources répondent : les cas muets sont explicites. */
function sourcesVivantes(
  muettes: readonly Activite[] = [],
): Record<Activite, EtatSource> {
  const out = {} as Record<Activite, EtatSource>;
  for (const a of ACTIVITES) out[a] = muettes.includes(a) ? 'muette' : 'ok';
  return out;
}

// Semaine du lundi 31 août au dimanche 6 septembre 2026.
const SEMAINE = semaineDe(new Date('2026-09-02T10:00:00Z'));

const RATIOS: Ratios = {
  niveau: 'personnel',
  provisoire: false,
  mandatsRetenus: 5,
  physiquesParQualifie: 8,
  qualifiesParEstimation: 3,
  estimationsParMandat: 2,
  physiquesParMandat: 48,
  positionMoyenne: 'dans',
};

function compteurs(partiel: Partial<Record<Activite, number>>): Record<Activite, number> {
  return { ...compteurVide(), ...partiel };
}

function entree(partiel: Partial<EntreePhrase>): EntreePhrase {
  return {
    compteurs: compteurVide(),
    objectifMandatsMois: 2,
    ratios: RATIOS,
    periode: 'semaine',
    intervalle: SEMAINE,
    semaine1: false,
    etatsSource: sourcesVivantes(),
    jourCourant: '2026-09-06', // dimanche : semaine complète
    ...partiel,
  };
}

describe('fractionEcoulee', () => {
  it('compte le jour en cours, pour ne pas déclarer tout le monde en avance le lundi', () => {
    // Lundi–samedi ouvrés : le lundi vaut 1/6, pas 0.
    const f = fractionEcoulee(SEMAINE, '2026-08-31');
    assert.ok(f > 0, 'le lundi ne doit pas valoir zéro');
    assert.ok(Math.abs(f - 1 / 6) < 0.001, `attendu 1/6, obtenu ${f}`);
  });

  it('vaut 1 sur une semaine passée', () => {
    assert.equal(fractionEcoulee(SEMAINE, '2026-10-05'), 1);
  });

  it('vaut 0 sur une semaine à venir', () => {
    assert.equal(fractionEcoulee(SEMAINE, '2026-08-01'), 0);
  });

  it('ignore le dimanche, qui n’est pas ouvré', () => {
    const samedi = fractionEcoulee(SEMAINE, '2026-09-05');
    const dimanche = fractionEcoulee(SEMAINE, '2026-09-06');
    assert.equal(samedi, 1);
    assert.equal(dimanche, 1);
  });
});

describe('rythmeRequis', () => {
  it('remonte l’entonnoir depuis l’objectif mensuel', () => {
    const r = rythmeRequis({ objectifMandatsMois: 2, ratios: RATIOS });
    assert.ok(r);
    assert.ok(Math.abs(r.mandats - 2 / SEMAINES_PAR_MOIS) < 1e-9);
    assert.ok(Math.abs(r.estimations - r.mandats * 2) < 1e-9);
    assert.ok(Math.abs(r.contacts_qualifies - r.estimations * 3) < 1e-9);
    assert.ok(Math.abs(r.contacts_physiques - r.contacts_qualifies * 8) < 1e-9);
  });

  it('ne calcule rien s’il manque un ratio', () => {
    assert.equal(
      rythmeRequis({
        objectifMandatsMois: 2,
        ratios: { ...RATIOS, qualifiesParEstimation: null },
      }),
      null,
    );
  });
});

describe('phrasePilotage', () => {
  it('vise le premier étage en retard en partant du haut', () => {
    // Une sortie déclarée, mais loin du compte : c'est le porte-à-porte qui
    // manque, pas le mandat.
    const p = phrasePilotage(entree({ compteurs: compteurs({ contacts_physiques: 3 }) }));
    assert.equal(p.ton, 'retard');
    assert.equal(p.levier, 'contacts_physiques');
    assert.match(p.texte, /porte-à-porte/);
    assert.match(p.texte, /rythme de 2 mandats par mois/);
  });

  it('ne reproche jamais un mandat manquant quand le haut de l’entonnoir tient', () => {
    // Volume de contacts largement suffisant, mais aucune qualification.
    const p = phrasePilotage(entree({ compteurs: compteurs({ contacts_physiques: 500 }) }));
    assert.equal(p.levier, 'contacts_qualifies');
    assert.notEqual(p.levier, 'mandats');
  });

  it('descend d’un étage à mesure que les précédents sont tenus', () => {
    const p = phrasePilotage(
      entree({
        // Huit mandats par mois : le dernier étage pèse assez pour qu'un zéro
        // s'y voie, là où un rythme d'un demi-mandat par semaine ne dit rien.
        objectifMandatsMois: 8,
        compteurs: compteurs({
          contacts_physiques: 500,
          contacts_qualifies: 100,
          estimations: 50,
        }),
      }),
    );
    assert.equal(p.levier, 'mandats');
    assert.equal(p.ton, 'retard');
  });

  it('annonce l’avance quand tous les étages tiennent', () => {
    const p = phrasePilotage(
      entree({
        compteurs: compteurs({
          contacts_physiques: 500,
          contacts_qualifies: 100,
          estimations: 50,
          mandats: 10,
        }),
      }),
    );
    assert.equal(p.ton, 'avance');
    assert.match(p.texte, /en avance/);
  });

  it('proratise : un lundi matin ne déclare pas l’agent en retard d’une semaine entière', () => {
    const commun = compteurs({ contacts_physiques: 4 });
    const lundi = phrasePilotage(entree({ compteurs: commun, jourCourant: '2026-08-31' }));
    const dimanche = phrasePilotage(entree({ compteurs: commun, jourCourant: '2026-09-06' }));
    assert.ok(
      lundi.manque < dimanche.manque,
      `lundi ${lundi.manque} devrait manquer moins que dimanche ${dimanche.manque}`,
    );
  });

  it('accorde le singulier', () => {
    // Un mandat par mois ne se lit qu'à l'échelle du mois : sur une semaine, le
    // rythme vaut un quart de mandat et il n'y a rien à annoncer.
    const p = phrasePilotage(
      entree({
        periode: 'mois',
        intervalle: intervalleDe('mois', new Date('2026-09-15T12:00:00Z')),
        jourCourant: '2026-09-30',
        objectifMandatsMois: 1,
        compteurs: compteurs({
          contacts_physiques: 500,
          contacts_qualifies: 100,
          estimations: 50,
          mandats: 0,
        }),
      }),
    );
    assert.match(p.texte, /1 mandat /);
    assert.match(p.texte, /rythme d’un mandat par mois/);
  });

  it('dit qu’il ne sait pas calculer plutôt que d’inventer un rythme', () => {
    const p = phrasePilotage(
      entree({ ratios: { ...RATIOS, estimationsParMandat: null } }),
    );
    assert.equal(p.ton, 'incalculable');
    assert.equal(p.levier, null);
    assert.match(p.texte, /repères de conversion/);
  });

  it('a sa propre phrase en semaine 1, sans chiffre de retard', () => {
    const p = phrasePilotage(entree({ semaine1: true }));
    assert.equal(p.ton, 'demarrage');
    assert.equal(p.manque, 0);
    assert.doesNotMatch(p.texte, /manque/);
  });
});

describe('phrasePilotage — une période sans rien de compté', () => {
  it('ne chiffre aucun manque quand tous les compteurs sont à zéro', () => {
    // Le défaut que corrige ce cas : le porte-à-porte muet écartait le premier
    // étage, l'étage suivant ne manquait que d'une unité, et l'écran annonçait
    // « il me manque 1 contact qualifié » au-dessus de cinq compteurs à zéro.
    const p = phrasePilotage(
      entree({
        periode: 'jour',
        intervalle: { debut: '2026-09-02', fin: '2026-09-02' },
        etatsSource: sourcesVivantes(['contacts_physiques']),
        jourCourant: '2026-09-02',
      }),
    );

    assert.doesNotMatch(p.texte, /il me manque/i);
    assert.match(p.texte, /Rien de compté aujourd’hui/);
    assert.match(p.texte, /rapproche de mon objectif/);
    assert.doesNotMatch(p.texte, /terrain/);
    // Le geste passe avant la règle du levier muet : c'est par là qu'on repart.
    assert.equal(p.levier, 'contacts_physiques');
  });

  it('montre la direction plutôt que le reproche', () => {
    // Une journée pas encore commencée n'est pas une contre-performance : le
    // texte dit déjà qu'il n'y a rien, la flèche vers le bas n'ajoute que du
    // sermon.
    assert.equal(phrasePilotage(entree({ jourCourant: '2026-08-31' })).ton, 'demarrage');
    assert.equal(phrasePilotage(entree({ jourCourant: '2026-09-06' })).ton, 'demarrage');
  });

  it('sait quand même ce que la période demandait', () => {
    // Le chiffre ne s'affiche pas, mais il sert au reste de l'écran.
    assert.ok(phrasePilotage(entree({ jourCourant: '2026-09-06' })).manque > 0);
  });
});

describe('phrasePilotage — plusieurs étages en retard', () => {
  it('annonce l’ampleur avant de nommer le geste', () => {
    // Le porte-à-porte tient, mais rien n'est qualifié ni estimé derrière :
    // deux étages décrochent, et n'en nommer qu'un ferait passer le rattrapage
    // pour une formalité.
    const p = phrasePilotage(entree({ compteurs: compteurs({ contacts_physiques: 500 }) }));

    assert.equal(p.ton, 'retard');
    assert.equal(p.levier, 'contacts_qualifies');
    assert.match(p.texte, /2 étages en retard/);
    assert.match(p.texte, /Je commence par/);
    assert.match(p.texte, /contacts qualifiés/);
  });

  it('garde la phrase simple quand un seul étage décroche', () => {
    const p = phrasePilotage(
      entree({ compteurs: compteurs({ contacts_physiques: 500, estimations: 50 }) }),
    );
    assert.match(p.texte, /^Il me manque /);
    assert.doesNotMatch(p.texte, /étages/);
  });

  it('ne reproche pas un étage dont l’objectif affiché est à zéro', () => {
    // Sur une journée, le rythme d'estimations vaut une fraction d'unité : la
    // carte affiche « 0 / 0 », donc la phrase ne peut pas en réclamer une.
    const p = phrasePilotage(
      entree({
        periode: 'jour',
        intervalle: { debut: '2026-09-02', fin: '2026-09-02' },
        jourCourant: '2026-09-02',
        compteurs: compteurs({ contacts_physiques: 1 }),
      }),
    );
    assert.doesNotMatch(p.texte, /estimation/);
  });
});

function tr(
  leadId: string,
  depuisCle: string | null,
  versCle: string,
  createdAt: string,
  profileId = MOI,
): TransitionRow {
  return { leadId, profileId, depuisCle, versCle, createdAt, banId: leadId };
}

const MOI = 'profil-moi';
const FENETRE = { debut: '2026-06-15', fin: '2026-09-06' };

function cohorte(transitions: readonly TransitionRow[]) {
  return entonnoirCohorte({
    transitions,
    profileId: MOI,
    fenetre: FENETRE,
    rangParCle: RANGS_CANONIQUES,
  });
}

describe('entonnoirCohorte', () => {
  it('suit les leads entrés dans la fenêtre jusqu’à leur étape la plus avancée', () => {
    const e = cohorte([
      // Trois leads pris, deux contactés, un allé jusqu'au mandat.
      tr('L1', null, 'pris', '2026-07-01T09:00:00Z'),
      tr('L1', 'pris', 'contacte', '2026-07-03T09:00:00Z'),
      tr('L1', 'contacte', 'estimation', '2026-07-10T09:00:00Z'),
      tr('L1', 'estimation', 'mandat', '2026-07-20T09:00:00Z'),
      tr('L2', null, 'pris', '2026-07-02T09:00:00Z'),
      tr('L2', 'pris', 'contacte', '2026-07-05T09:00:00Z'),
      tr('L3', null, 'pris', '2026-07-04T09:00:00Z'),
    ]);

    assert.deepEqual(
      e.map((x) => x.valeur),
      [3, 2, 1, 1],
    );
    assert.equal(e[0]!.conversion, null);
    assert.ok(Math.abs(e[1]!.conversion! - 66.7) < 0.1);
  });

  it('ne peut JAMAIS produire un étage plus large que celui du dessus', () => {
    // Le défaut que corrige la cohorte : un mandat signé dans la fenêtre pour
    // un lead entré AVANT elle ne doit pas apparaître sous une estimation à zéro.
    const e = cohorte([
      tr('vieux', 'estimation', 'mandat', '2026-08-01T09:00:00Z'),
      tr('vieux', 'rendez_vous', 'estimation', '2026-05-01T09:00:00Z'),
      tr('neuf', null, 'pris', '2026-07-01T09:00:00Z'),
    ]);

    // « vieux » n'est pas entré dans la fenêtre : il sort de la cohorte.
    assert.deepEqual(
      e.map((x) => x.valeur),
      [1, 0, 0, 0],
    );
    for (let i = 1; i < e.length; i += 1) {
      assert.ok(e[i]!.valeur <= e[i - 1]!.valeur, `étage ${i} plus large que le précédent`);
    }
  });

  it('compte l’étape la plus avancée même atteinte après la fenêtre', () => {
    const e = cohorte([
      tr('L1', null, 'pris', '2026-09-01T09:00:00Z'),
      // Mandat signé après la fin de fenêtre : le travail reste celui de l'agent.
      tr('L1', 'contacte', 'mandat', '2026-10-15T09:00:00Z'),
    ]);
    assert.equal(e[3]!.valeur, 1);
  });

  it('ne compte pas « perdu » comme une avancée', () => {
    const e = cohorte([
      tr('L1', null, 'pris', '2026-07-01T09:00:00Z'),
      tr('L1', 'pris', 'perdu', '2026-07-08T09:00:00Z'),
    ]);
    assert.deepEqual(
      e.map((x) => x.valeur),
      [1, 0, 0, 0],
    );
  });

  it('suit un lead repris par un collègue', () => {
    const e = cohorte([
      tr('L1', null, 'pris', '2026-07-01T09:00:00Z'),
      tr('L1', 'pris', 'mandat', '2026-07-20T09:00:00Z', 'un-collegue'),
    ]);
    assert.equal(e[3]!.valeur, 1);
  });

  it('exclut les leads entrés au nom d’un autre collaborateur', () => {
    const e = cohorte([tr('L1', null, 'pris', '2026-07-01T09:00:00Z', 'quelqu-un-dautre')]);
    assert.equal(entonnoirVide(e), true);
  });

  it('ne divise pas par zéro quand personne n’est entré', () => {
    const e = cohorte([]);
    assert.ok(e.every((x) => x.part === 0 && x.conversion === null));
    assert.equal(entonnoirVide(e), true);
  });
});

describe('phrasePilotage — sources muettes', () => {
  it('ne désigne jamais une source muette comme levier', () => {
    // Sans sortie enregistrée, le porte-à-porte affiche le plus gros retard.
    // Le levier doit malgré tout descendre à l'étage suivant.
    const p = phrasePilotage(
      entree({
        etatsSource: sourcesVivantes(['contacts_physiques']),
        compteurs: compteurs({ informations_terrain: 3 }),
      }),
    );
    assert.notEqual(p.levier, 'contacts_physiques');
    assert.equal(p.levier, 'contacts_qualifies');
  });

  it('descend jusqu’au premier étage réellement mesuré', () => {
    const p = phrasePilotage(
      entree({
        etatsSource: sourcesVivantes(['contacts_physiques', 'contacts_qualifies', 'estimations']),
        compteurs: compteurs({ informations_terrain: 3 }),
        objectifMandatsMois: 8,
      }),
    );
    assert.equal(p.levier, 'mandats');
  });

  it('bascule en démarrage si toutes les sources sont muettes', () => {
    const p = phrasePilotage(
      entree({
        etatsSource: sourcesVivantes([
          'contacts_physiques',
          'contacts_qualifies',
          'estimations',
          'mandats',
        ]),
      }),
    );
    assert.equal(p.ton, 'demarrage');
    assert.equal(p.manque, 0);
    assert.doesNotMatch(p.texte, /manque/);
  });

  it('mesure l’avance sur le premier étage vivant, pas sur un étage muet', () => {
    const p = phrasePilotage(
      entree({
        etatsSource: sourcesVivantes(['contacts_physiques']),
        compteurs: compteurs({
          contacts_qualifies: 500,
          estimations: 200,
          mandats: 50,
        }),
      }),
    );
    assert.equal(p.ton, 'avance');
    assert.equal(p.levier, 'contacts_qualifies');
    assert.match(p.texte, /contacts qualifiés/);
  });
});

describe('phrasePilotage — mise à l’échelle de la période', () => {
  it('exige davantage sur un mois que sur une semaine', () => {
    const septembre = intervalleDe('mois', new Date('2026-09-15T12:00:00Z'));
    const surLeMois = phrasePilotage(
      entree({ periode: 'mois', intervalle: septembre, jourCourant: '2026-09-30' }),
    );
    const surLaSemaine = phrasePilotage(entree({}));

    // Septembre vaut ~4,3 semaines : le manque doit suivre, pas rester identique.
    assert.ok(
      surLeMois.manque > surLaSemaine.manque * 3,
      `mois ${surLeMois.manque} devrait dépasser largement semaine ${surLaSemaine.manque}`,
    );
  });

  it('nomme la période dans la phrase', () => {
    const septembre = intervalleDe('mois', new Date('2026-09-15T12:00:00Z'));
    assert.match(
      phrasePilotage(entree({ periode: 'mois', intervalle: septembre })).texte,
      /ce mois-ci/,
    );
    assert.match(
      phrasePilotage(
        entree({ periode: 'jour', intervalle: { debut: '2026-09-02', fin: '2026-09-02' } }),
      ).texte,
      /aujourd’hui/,
    );
    assert.match(phrasePilotage(entree({})).texte, /cette semaine/);
  });

  it('ne déclare pas un agent brillant parce qu’il regarde l’année', () => {
    // Un cumul annuel confortable reste insuffisant face à un objectif annuel.
    const annee = intervalleDe('annee', new Date('2026-06-15T12:00:00Z'));
    const p = phrasePilotage(
      entree({
        periode: 'annee',
        intervalle: annee,
        jourCourant: '2026-12-31',
        compteurs: { ...compteurVide(), contacts_physiques: 200 },
      }),
    );
    assert.equal(p.ton, 'retard');
  });
});
