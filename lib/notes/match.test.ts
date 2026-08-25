import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { confianceImmeuble, matchContacts, transcriptMentions } from './match';

const jean = {
  id: 'c1',
  agencyId: 'a1',
  firstName: 'Jean',
  lastName: 'Dupont',
  fullName: 'Jean Dupont',
  phone: '0612345678',
  email: 'jean@ex.fr',
  address: '12 rue des Lilas',
  banId: '59122_x',
};

describe('matchContacts', () => {
  it('classe un téléphone identique en certain', () => {
    const hits = matchContacts(
      { firstName: '', lastName: '', phone: '06 12 34 56 78', email: null },
      [jean],
      'a1',
    );
    assert.equal(hits.length, 1);
    assert.equal(hits[0]?.confiance, 'certain');
    assert.equal(hits[0]?.raison, 'telephone');
  });

  it('classe un nom approchant en probable', () => {
    const hits = matchContacts(
      { firstName: 'Jean', lastName: 'Dupont', phone: null, email: null },
      [jean],
      'a1',
    );
    assert.equal(hits.length, 1);
    assert.equal(hits[0]?.confiance, 'probable');
  });

  it('n’applique rien d’une autre agence', () => {
    const hits = matchContacts(
      { firstName: 'Jean', lastName: 'Dupont', phone: '0612345678', email: null },
      [jean],
      'autre',
    );
    assert.equal(hits.length, 0);
  });
});

describe('confianceImmeuble', () => {
  it('n’est certain qu’à partir de 0,7', () => {
    assert.equal(confianceImmeuble(0.69), 'probable');
    assert.equal(confianceImmeuble(0.7), 'certain');
    assert.equal(confianceImmeuble(null), null);
  });
});

describe('transcriptMentions', () => {
  it('retrouve un nom ou un téléphone dans la dictée', () => {
    assert.equal(transcriptMentions('Vu Jean Dupont ce matin', ['Jean Dupont']), true);
    assert.equal(transcriptMentions('Son numéro 06 12 34 56 78', [null, '0612345678']), true);
    assert.equal(transcriptMentions(' RAS ', ['Dupont']), false);
  });
});
