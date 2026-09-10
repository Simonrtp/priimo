import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { adresseAJuger, decouperAdresse, memeVoie, normaliserVoie } from './adresse';

describe('découpage d’une adresse de lead', () => {
  it('sépare numéro, voie et code postal', () => {
    assert.deepEqual(decouperAdresse('94 Rue de Buzenval 75020 Paris'), {
      numero: 94,
      nomVoie: 'Rue de Buzenval',
      codePostal: '75020',
    });
  });

  it('absorbe un suffixe de numéro sans l’ajouter à la voie', () => {
    assert.deepEqual(decouperAdresse('9 bis Avenue Taillade 75020 Paris'), {
      numero: 9,
      nomVoie: 'Avenue Taillade',
      codePostal: '75020',
    });
  });

  it('ne prend pas le premier mot de la voie pour un suffixe', () => {
    const a = decouperAdresse('12 Rue des Mûriers 75020 Paris');
    assert.equal(a.numero, 12);
    assert.equal(a.nomVoie, 'Rue des Mûriers');
  });

  it('ne confond pas un nombre dans le nom de voie avec le code postal', () => {
    const a = decouperAdresse('3 Rue du 8 Mai 1945 93100 Montreuil');
    assert.equal(a.numero, 3);
    assert.equal(a.nomVoie, 'Rue du 8 Mai 1945');
    assert.equal(a.codePostal, '93100');
  });

  it('accepte une adresse sans numéro', () => {
    assert.deepEqual(decouperAdresse('Boulevard de Charonne 75020 Paris'), {
      numero: null,
      nomVoie: 'Boulevard de Charonne',
      codePostal: '75020',
    });
  });

  it('ne devine rien sur une chaîne vide', () => {
    assert.deepEqual(decouperAdresse(''), {
      numero: null,
      nomVoie: null,
      codePostal: null,
    });
    assert.deepEqual(decouperAdresse(null), {
      numero: null,
      nomVoie: null,
      codePostal: null,
    });
  });
});

describe('normalisation d’un nom de voie', () => {
  it('efface accents, casse et ponctuation', () => {
    assert.equal(normaliserVoie('Rue des Mûriers'), 'rue des muriers');
    assert.equal(normaliserVoie('  RUE   DES   MURIERS '), 'rue des muriers');
  });

  it('développe les abréviations de type de voie', () => {
    assert.equal(normaliserVoie('Bd St-Germain'), 'boulevard saint germain');
    assert.equal(normaliserVoie('Av. de la République'), 'avenue de la republique');
  });

  it('reconnaît la même voie écrite de deux façons', () => {
    assert.equal(memeVoie('Bd Saint-Germain', 'Boulevard Saint Germain'), true);
    assert.equal(memeVoie('Rue des Maraîchers', 'rue des maraichers'), true);
  });

  it('ne rapproche pas deux voies différentes', () => {
    assert.equal(memeVoie('Rue de Bagnolet', 'Rue de Buzenval'), false);
    // Un article change la rue : « rue de la Paix » n'est pas « rue Paix ».
    assert.equal(memeVoie('Rue de la Paix', 'Rue Paix'), false);
  });

  it('ne rapproche rien quand un côté manque', () => {
    assert.equal(memeVoie(null, 'Rue de Bagnolet'), false);
    assert.equal(memeVoie('Rue de Bagnolet', null), false);
  });
});

describe('adresse à juger', () => {
  it('préfère la colonne code postal au code deviné dans le texte', () => {
    const a = adresseAJuger({
      address: '94 Rue de Buzenval 75020 Paris',
      postalCode: '75011',
      latitude: 48.85,
      longitude: 2.4,
    });
    assert.equal(a.codePostal, '75011');
    assert.equal(a.numero, 94);
    assert.equal(a.latitude, 48.85);
  });

  it('retombe sur le code postal du texte quand la colonne est vide', () => {
    const a = adresseAJuger({ address: '1 Rue Robineau 75020 Paris' });
    assert.equal(a.codePostal, '75020');
    assert.equal(a.latitude, null);
    assert.equal(a.parcelleId, null);
  });
});
