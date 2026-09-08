import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  objectifsEffectifs,
  referenceMetier,
  OBJECTIFS_HEBDO_PAR_DEFAUT,
  OBJECTIF_MANDATS_MENSUEL_PAR_DEFAUT,
  REFERENCE_METIER_PROVISOIRE,
} from './objectifs';
import { cascadeRatios, MANDATS_MINIMUM, type EtapesConversion } from './ratios';

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
