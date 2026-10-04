import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ficheDepuisResultat, raccourcirQualite } from './annuaire-entreprises';

describe('raccourcirQualite', () => {
  it('garde le rôle utile pour l’agent', () => {
    assert.equal(raccourcirQualite('Gérant et associé indéfiniment responsable'), 'Gérant');
    assert.equal(raccourcirQualite('Président du directoire'), 'Président');
    assert.equal(raccourcirQualite('Directeur général'), 'Directeur général');
    assert.equal(raccourcirQualite('Autre'), null);
  });
});

describe('ficheDepuisResultat', () => {
  it('priorise les gérants personnes physiques et ignore les commissaires', () => {
    const f = ficheDepuisResultat(
      {
        siren: '917419558',
        etat_administratif: 'A',
        date_creation: '2022-06-28',
        siege: { geo_adresse: '3131 R DES CANADIENS 76160 SAINT-JACQUES-SUR-DARNETAL' },
        dirigeants: [
          {
            nom: 'AUDITEX',
            denomination: 'AUDITEX',
            qualite: 'Commissaire aux comptes titulaire',
            type_dirigeant: 'personne morale',
          },
          {
            nom: 'CADOT (BLONDELET)',
            prenoms: 'CECILE DOMINIQUE ELISE',
            qualite: 'Gérant et associé indéfiniment responsable',
            type_dirigeant: 'personne physique',
          },
          {
            nom: 'CADOT',
            prenoms: 'PIERRE MARIE MARCEAU PAUL',
            qualite: 'Gérant et associé indéfiniment responsable',
            type_dirigeant: 'personne physique',
          },
          {
            nom: 'MARTIN',
            prenoms: 'JEAN',
            qualite: 'Autre',
            type_dirigeant: 'personne physique',
          },
        ],
      },
      '917419558',
    );

    assert.equal(f.active, true);
    assert.equal(f.dateCreation, '2022-06-28');
    assert.match(f.siege ?? '', /Saint-Jacques/i);
    assert.deepEqual(
      f.dirigeants.map((d) => [d.nom, d.qualite]),
      [
        ['Cecile Cadot', 'Gérant'],
        ['Pierre Cadot', 'Gérant'],
        ['Jean Martin', null],
      ],
    );
  });

  it('marque une société radiée', () => {
    const f = ficheDepuisResultat({ etat_administratif: 'C', dirigeants: [] }, '123456789');
    assert.equal(f.active, false);
    assert.equal(f.dirigeants.length, 0);
  });
});
