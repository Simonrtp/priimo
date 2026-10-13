import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { prefillColonnesParcelle, typeDepuisBatiment } from './prefill-parcelle';
import type { EstimationBien } from './objet';

const MAINTENANT = new Date('2026-10-13T12:00:00Z');

function bienDe(colonnes: Record<string, unknown>): EstimationBien {
  return colonnes.bien as EstimationBien;
}

describe('typeDepuisBatiment', () => {
  it('lit le collectif et l’individuel', () => {
    assert.equal(typeDepuisBatiment('Résidentiel collectif', 40), 'appartement');
    assert.equal(typeDepuisBatiment('Résidentiel individuel', 1), 'maison');
  });

  it('un résidentiel de plusieurs logements est un immeuble', () => {
    assert.equal(typeDepuisBatiment('Résidentiel', 12), 'appartement');
    assert.equal(typeDepuisBatiment('Résidentiel', 1), null);
    assert.equal(typeDepuisBatiment(null, 8), null);
  });
});

describe('prefillColonnesParcelle', () => {
  it('un immeuble ne reçoit que le type, l’année et la hauteur', () => {
    const colonnes = prefillColonnesParcelle(
      {
        id: '75120000CC0044',
        adresse: '5 rue Orfila',
        codePostal: '75020',
        ville: 'Paris',
        banId: '75120_6924_00005',
        latitude: 48.86,
        longitude: 2.39,
        batiment: {
          usage: 'Résidentiel collectif',
          anneeConstruction: 1928,
          niveaux: 8,
          nbLogements: 31,
        },
        logements: [
          {
            date: '2026-06-23',
            etiquette: 'D',
            etiquetteGes: 'B',
            consoKwhM2: 211,
            surface: 35,
            etage: 2,
          },
        ],
        ventes: [{ typeLocal: 'Appartement', nombrePieces: 2, surface: 35 }],
      },
      MAINTENANT,
    );

    assert.ok(colonnes);
    assert.equal(colonnes.property_type, 'appartement');
    assert.equal(colonnes.address, '5 rue Orfila');
    assert.equal(colonnes.surface_m2, undefined);
    assert.equal(colonnes.rooms, undefined);
    assert.equal(colonnes.floor, undefined);
    assert.equal(colonnes.dpe_class, undefined);
    const bien = bienDe(colonnes);
    assert.equal(bien.anneeConstruction, 1928);
    assert.equal(bien.etagesImmeuble, 8);
    assert.equal(bien.niveaux, null);
    assert.equal(bien.ges, null);
    assert.equal(bien.consoKwh, null);
  });

  it('une maison reçoit aussi le logement, depuis le diagnostic le plus récent', () => {
    const colonnes = prefillColonnesParcelle(
      {
        id: '94001000AB0012',
        adresse: '12 rue des Lilas',
        codePostal: '94000',
        ville: 'Créteil',
        batiment: {
          usage: 'Résidentiel individuel',
          anneeConstruction: 1934,
          niveaux: 2,
          nbLogements: 1,
        },
        logements: [
          { date: '2018-04-01', etiquette: 'G', etiquetteGes: 'F', consoKwhM2: 420, surface: 92, etage: null },
          { date: '2024-11-02', etiquette: 'D', etiquetteGes: 'C', consoKwhM2: 186, surface: 95, etage: 1 },
        ],
        ventes: [{ typeLocal: 'Maison', nombrePieces: 5, surface: 94 }],
      },
      MAINTENANT,
    );

    assert.ok(colonnes);
    assert.equal(colonnes.property_type, 'maison');
    assert.equal(colonnes.surface_m2, 95);
    assert.equal(colonnes.rooms, 5);
    assert.equal(colonnes.floor, '1');
    assert.equal(colonnes.dpe_class, 'D');
    const bien = bienDe(colonnes);
    assert.equal(bien.anneeConstruction, 1934);
    assert.equal(bien.niveaux, 2);
    assert.equal(bien.etagesImmeuble, null);
    assert.equal(bien.ges, 'C');
    assert.equal(bien.consoKwh, 186);
  });

  it('deux maisons sur la parcelle : pas de surface, de DPE ni de pièces', () => {
    const colonnes = prefillColonnesParcelle(
      {
        id: '94001000AB0099',
        batiment: { usage: 'Résidentiel individuel', anneeConstruction: 1960, niveaux: 2, nbLogements: 2 },
        logements: [
          { date: '2024-01-01', etiquette: 'E', surface: 70, etage: 1 },
          { date: '2025-01-01', etiquette: 'C', surface: 140, etage: 1 },
        ],
        ventes: [
          { typeLocal: 'Maison', nombrePieces: 4, surface: 70 },
          { typeLocal: 'Maison', nombrePieces: 4, surface: 140 },
        ],
      },
      MAINTENANT,
    );

    assert.ok(colonnes);
    assert.equal(colonnes.property_type, 'maison');
    assert.equal(colonnes.surface_m2, undefined);
    assert.equal(colonnes.rooms, undefined);
    assert.equal(colonnes.dpe_class, undefined);
    assert.equal(bienDe(colonnes).niveaux, 2);
    assert.equal(bienDe(colonnes).ges, null);
  });

  it('sans bâtiment connu, seule l’adresse part', () => {
    const colonnes = prefillColonnesParcelle(
      {
        id: '75120000CC0107',
        adresse: '33 rue Orfila',
        logements: [{ date: '2026-01-01', etiquette: 'E', surface: 40, etage: 3 }],
      },
      MAINTENANT,
    );
    assert.ok(colonnes);
    assert.equal(colonnes.property_type, undefined);
    assert.equal(colonnes.dpe_class, undefined);
    assert.equal(colonnes.bien, undefined);
  });

  it('refuse une année impossible et une parcelle sans id', () => {
    const colonnes = prefillColonnesParcelle(
      {
        id: 'x',
        batiment: { usage: 'Résidentiel collectif', anneeConstruction: 1400, niveaux: 3 },
      },
      MAINTENANT,
    );
    assert.ok(colonnes);
    assert.equal(bienDe(colonnes).anneeConstruction, null);
    assert.equal(bienDe(colonnes).etagesImmeuble, 3);
    assert.equal(prefillColonnesParcelle({ adresse: 'sans id' }), null);
  });
});
