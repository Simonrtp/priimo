import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { adresseLisible, formaterVoie, villeLisible } from './adresse-lisible';

describe('formaterVoie', () => {
  it('remet une casse française sur une adresse en capitales', () => {
    assert.equal(formaterVoie('10 RUE DES MARAICHERS'), '10 rue des Maraichers');
    assert.equal(formaterVoie('3 BIS AVENUE DU GENERAL DE GAULLE'), '3 bis avenue du General de Gaulle');
    assert.equal(formaterVoie("5 PLACE D'ITALIE"), '5 place d’Italie');
  });

  it('garde la majuscule de tête et les noms composés', () => {
    assert.equal(formaterVoie('RUE DE RIVOLI'), 'Rue de Rivoli');
    assert.equal(formaterVoie('8 RUE JEAN-JACQUES ROUSSEAU'), '8 rue Jean-Jacques Rousseau');
  });
});

describe('villeLisible', () => {
  it('retire l’arrondissement que le code postal dit déjà', () => {
    assert.equal(villeLisible('Paris 20e Arrondissement'), 'Paris');
    assert.equal(villeLisible('Lyon 1er Arrondissement'), 'Lyon');
    assert.equal(villeLisible('LE PRE-SAINT-GERVAIS'), 'Le Pre-Saint-Gervais');
    assert.equal(villeLisible(null), null);
  });
});

describe('adresseLisible', () => {
  it('sépare la localité collée au libellé BAN', () => {
    assert.deepEqual(adresseLisible('12 Rue des Maraîchers 75020 Paris'), {
      voie: '12 rue des Maraîchers',
      localite: '75020 Paris',
    });
    assert.deepEqual(adresseLisible('12 rue des Lilas, 75020 Paris'), {
      voie: '12 rue des Lilas',
      localite: '75020 Paris',
    });
  });

  it('complète la localité depuis le référentiel quand le libellé n’en a pas', () => {
    assert.deepEqual(
      adresseLisible('10 RUE DES MARAICHERS', { codePostal: '75020', commune: 'Paris 20e Arrondissement' }),
      { voie: '10 rue des Maraichers', localite: '75020 Paris' },
    );
  });
});
