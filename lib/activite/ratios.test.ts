import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  lignesObjectifs,
  objectifACadence,
  objectifDepuisCadence,
  objectifsEffectifs,
  parseObjectifsSaisis,
  referenceMetier,
  saisieDepuisObjectifs,
  OBJECTIF_MAX,
  OBJECTIFS_HEBDO_PAR_DEFAUT,
  OBJECTIF_MANDATS_MENSUEL_PAR_DEFAUT,
  REFERENCE_METIER_PROVISOIRE,
} from './objectifs';
import {
  cascadeRatios,
  formateRatio,
  MANDATS_MINIMUM,
  physiquesParMandatDepuis,
  positionVsMoyenne,
  type EtapesConversion,
} from './ratios';

function etapes(partiel: Partial<EtapesConversion>): EtapesConversion {
  return {
    contacts_physiques: 0,
    contacts_qualifies: 0,
    estimations: 0,
    mandats: 0,
    ...partiel,
  };
}

const AUCUNE_ACTIVITE = etapes({});

describe('cascadeRatios — choix du niveau', () => {
  it('prend le ratio personnel dès trois mandats', () => {
    const r = cascadeRatios({
      personnel: etapes({
        contacts_physiques: 120,
        contacts_qualifies: 24,
        estimations: 9,
        mandats: MANDATS_MINIMUM,
      }),
      agence: etapes({ mandats: 40 }),
      reference: REFERENCE_METIER_PROVISOIRE,
      referenceFournie: true,
    });

    assert.equal(r.niveau, 'personnel');
    assert.equal(r.provisoire, false);
    assert.equal(r.physiquesParQualifie, 5);
    assert.equal(r.qualifiesParEstimation, 2.7);
    assert.equal(r.estimationsParMandat, 3);
    assert.equal(r.physiquesParMandat, 40);
  });

  it('retombe sur l’agence sous trois mandats personnels', () => {
    const r = cascadeRatios({
      personnel: etapes({ contacts_physiques: 90, contacts_qualifies: 10, mandats: 2 }),
      agence: etapes({
        contacts_physiques: 400,
        contacts_qualifies: 50,
        estimations: 20,
        mandats: 5,
      }),
      reference: REFERENCE_METIER_PROVISOIRE,
      referenceFournie: true,
    });

    assert.equal(r.niveau, 'agence');
    assert.equal(r.mandatsRetenus, 5);
    assert.equal(r.physiquesParQualifie, 8);
  });

  it('retombe sur la référence quand l’agence non plus n’a pas trois mandats', () => {
    const r = cascadeRatios({
      personnel: AUCUNE_ACTIVITE,
      agence: etapes({ mandats: 2 }),
      reference: {
        physiquesParQualifie: 11,
        qualifiesParEstimation: 4,
        estimationsParMandat: 2.5,
      },
      referenceFournie: true,
    });

    assert.equal(r.niveau, 'reference');
    assert.equal(r.provisoire, false);
    assert.equal(r.physiquesParQualifie, 11);
  });

  it('signale « provisoire » tant que le réseau n’a pas fourni ses chiffres', () => {
    const r = cascadeRatios({
      personnel: AUCUNE_ACTIVITE,
      agence: AUCUNE_ACTIVITE,
      reference: REFERENCE_METIER_PROVISOIRE,
      referenceFournie: false,
    });

    assert.equal(r.niveau, 'reference');
    assert.equal(r.provisoire, true);
  });

  it('ne fabrique pas un ratio à partir d’un dénominateur nul', () => {
    const r = cascadeRatios({
      personnel: etapes({ contacts_physiques: 50, contacts_qualifies: 0, mandats: 4 }),
      agence: AUCUNE_ACTIVITE,
      reference: REFERENCE_METIER_PROVISOIRE,
      referenceFournie: true,
    });

    assert.equal(r.niveau, 'personnel');
    assert.equal(r.physiquesParQualifie, null);
    assert.equal(r.estimationsParMandat, 0);
  });

  it('jour 1 : aucune donnée nulle part, la référence est annoncée comme telle', () => {
    const r = cascadeRatios({
      personnel: AUCUNE_ACTIVITE,
      agence: AUCUNE_ACTIVITE,
      reference: REFERENCE_METIER_PROVISOIRE,
      referenceFournie: false,
    });

    assert.equal(r.mandatsRetenus, 0);
    assert.equal(r.provisoire, true);
    assert.notEqual(r.physiquesParQualifie, null);
  });
});

describe('physiquesParMandatDepuis', () => {
  it('multiplie les trois paliers : 5 × 3 × 3,6 = 54', () => {
    assert.equal(
      physiquesParMandatDepuis({
        physiquesParQualifie: 5,
        qualifiesParEstimation: 3,
        estimationsParMandat: 3.6,
      }),
      54,
    );
  });
});

describe('positionVsMoyenne', () => {
  it('dit « dans » autour de la moyenne', () => {
    assert.equal(positionVsMoyenne(54, 50), 'dans');
  });

  it('dit « mieux » quand il faut nettement moins de portes', () => {
    assert.equal(positionVsMoyenne(40, 54), 'mieux');
  });
});

describe('formateRatio', () => {
  it('arrondit le gros chiffre, garde une décimale en dessous de 10', () => {
    assert.equal(formateRatio(54.2), '54');
    assert.equal(formateRatio(2.7), '2,7');
  });
});

describe('objectifsEffectifs', () => {
  it('sert les défauts quand le directeur n’a rien posé', () => {
    const o = objectifsEffectifs([]);
    assert.deepEqual(o.hebdo, OBJECTIFS_HEBDO_PAR_DEFAUT);
    assert.equal(o.mandatsMensuel, OBJECTIF_MANDATS_MENSUEL_PAR_DEFAUT);
    assert.equal(o.parDefaut, true);
  });

  it('remplace uniquement les objectifs posés', () => {
    const o = objectifsEffectifs([
      { activite: 'contacts_physiques', periode: 'hebdo', cible: 70 },
      { activite: 'mandats', periode: 'mensuel', cible: 5 },
    ]);

    assert.equal(o.hebdo.contacts_physiques, 70);
    assert.equal(o.hebdo.estimations, OBJECTIFS_HEBDO_PAR_DEFAUT.estimations);
    assert.equal(o.mandatsMensuel, 5);
    assert.equal(o.parDefaut, false);
  });

  it('ignore une activité inconnue ou une cible absurde', () => {
    const o = objectifsEffectifs([
      { activite: 'portes_claquees', periode: 'hebdo', cible: 12 },
      { activite: 'estimations', periode: 'hebdo', cible: -4 },
    ]);

    assert.equal(o.hebdo.estimations, OBJECTIFS_HEBDO_PAR_DEFAUT.estimations);
    assert.equal(o.parDefaut, true);
  });

  it('accepte un objectif à zéro, qui est une décision et pas un oubli', () => {
    const o = objectifsEffectifs([
      { activite: 'informations_terrain', periode: 'hebdo', cible: 0 },
    ]);
    assert.equal(o.hebdo.informations_terrain, 0);
    assert.equal(o.parDefaut, false);
  });
});

describe('objectifs saisis à l’écran', () => {
  const saisie = {
    hebdo: {
      contacts_physiques: 40,
      immeubles_prospectes: 25,
      contacts_qualifies: 8,
      estimations: 2,
      informations_terrain: 6,
    },
    mandatsMensuel: 4,
  };

  it('propose les objectifs en cours, familles et mandats séparés', () => {
    const depart = saisieDepuisObjectifs(objectifsEffectifs([]));
    assert.equal(depart.hebdo.estimations, OBJECTIFS_HEBDO_PAR_DEFAUT.estimations);
    assert.equal(depart.mandatsMensuel, OBJECTIF_MANDATS_MENSUEL_PAR_DEFAUT);
    // L'objectif hebdomadaire de mandats ne se saisit pas : il sert aux ratios.
    assert.equal('mandats' in depart.hebdo, false);
  });

  it('accepte une saisie complète, zéro compris', () => {
    const lu = parseObjectifsSaisis({ ...saisie, hebdo: { ...saisie.hebdo, estimations: 0 } });
    assert.equal(lu?.hebdo.estimations, 0);
    assert.equal(lu?.mandatsMensuel, 4);
  });

  it('refuse tout le lot dès qu’une cible sort des bornes', () => {
    assert.equal(parseObjectifsSaisis({ ...saisie, mandatsMensuel: -1 }), null);
    assert.equal(
      parseObjectifsSaisis({ ...saisie, hebdo: { ...saisie.hebdo, estimations: OBJECTIF_MAX + 1 } }),
      null,
    );
    assert.equal(
      parseObjectifsSaisis({ ...saisie, hebdo: { ...saisie.hebdo, estimations: 2.5 } }),
      null,
    );
    assert.equal(parseObjectifsSaisis({ ...saisie, hebdo: { contacts_physiques: 40 } }), null);
    assert.equal(parseObjectifsSaisis(null), null);
  });

  it('écrit six lignes, et jamais l’objectif hebdomadaire de mandats', () => {
    const lignes = lignesObjectifs(saisie);
    assert.equal(lignes.length, 6);
    assert.equal(
      lignes.some((l) => l.activite === 'mandats' && l.periode === 'hebdo'),
      false,
    );
    assert.deepEqual(
      lignes.find((l) => l.activite === 'mandats'),
      { activite: 'mandats', periode: 'mensuel', cible: 4 },
    );
  });

  it('lit le même objectif hebdomadaire à quatre cadences', () => {
    assert.equal(objectifACadence(50, 'semaine'), 50);
    assert.equal(objectifACadence(50, 'jour'), 7);
    assert.equal(objectifACadence(50, 'mois'), 217);
    assert.equal(objectifACadence(50, 'annee'), 2607);
  });

  it('revient à la semaine sans dériver quand on saisit ailleurs', () => {
    // Ce qu'on voit à une cadence doit se ressaisir à l'identique : sinon un
    // aller-retour par la vue « Jour » raboterait l'objectif à chaque passage.
    for (const cadence of ['jour', 'semaine', 'mois', 'annee'] as const) {
      const vu = objectifACadence(50, cadence);
      const relu = objectifACadence(objectifDepuisCadence(vu, cadence), cadence);
      assert.equal(relu, vu, `dérive à la cadence ${cadence}`);
    }
  });

  it('ne laisse pas une saisie absurde franchir la conversion', () => {
    assert.equal(objectifDepuisCadence(9999, 'jour'), OBJECTIF_MAX);
    assert.equal(objectifDepuisCadence(0, 'mois'), 0);
  });

  it('rend à l’écran ce qui vient d’être écrit', () => {
    const relu = objectifsEffectifs(lignesObjectifs(saisie));
    assert.deepEqual(saisieDepuisObjectifs(relu), saisie);
    assert.equal(relu.parDefaut, false);
    // Non réécrit, donc toujours au défaut : c'est voulu.
    assert.equal(relu.hebdo.mandats, OBJECTIFS_HEBDO_PAR_DEFAUT.mandats);
  });
});

describe('referenceMetier', () => {
  it('marque « non fournie » quand la ligne est absente', () => {
    const { reference, fournie } = referenceMetier(null);
    assert.equal(fournie, false);
    assert.deepEqual(reference, REFERENCE_METIER_PROVISOIRE);
  });

  it('marque « non fournie » quand les trois ratios sont vides', () => {
    const { fournie } = referenceMetier({
      physiques_par_qualifie: null,
      qualifies_par_estimation: null,
      estimations_par_mandat: null,
    });
    assert.equal(fournie, false);
  });

  it('lit un numeric rendu en chaîne par le client Supabase', () => {
    const { reference, fournie } = referenceMetier({
      physiques_par_qualifie: '12.50',
      qualifies_par_estimation: null,
      estimations_par_mandat: '2.00',
    });

    assert.equal(fournie, true);
    assert.equal(reference.physiquesParQualifie, 12.5);
    assert.equal(reference.estimationsParMandat, 2);
    // Le trou est comblé par le provisoire, pas laissé à null.
    assert.equal(
      reference.qualifiesParEstimation,
      REFERENCE_METIER_PROVISOIRE.qualifiesParEstimation,
    );
  });
});
