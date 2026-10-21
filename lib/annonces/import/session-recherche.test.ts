import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { lireSession } from './session-recherche';

describe('session de recherche d’annonce', () => {
  it('reprend l’URL et l’annonce déjà trouvée', () => {
    const session = lireSession(
      JSON.stringify({
        url: 'https://www.seloger.com/annonces/123.htm',
        etat: {
          k: 'trouvee',
          disponible: true,
          carte: { url: 'https://www.seloger.com/annonces/123.htm', portail: 'SeLoger', prix: 420000 },
        },
        etapes: {},
      }),
    );
    assert.equal(session?.url, 'https://www.seloger.com/annonces/123.htm');
    assert.equal(session?.etat.k, 'trouvee');
    if (session?.etat.k === 'trouvee') assert.equal(session.etat.carte.prix, 420000);
  });

  it('reprend une recherche encore en cours', () => {
    const session = lireSession(
      JSON.stringify({
        url: 'https://www.pap.fr/annonce/1',
        etat: { k: 'travail', fini: false, depuis: 10 },
        etapes: { lecture: { cle: 'lecture', etat: 'en_cours' } },
      }),
    );
    assert.equal(session?.etat.k, 'travail');
    assert.equal(session?.etapes.lecture?.etat, 'en_cours');
  });

  it('ignore un enregistrement illisible', () => {
    assert.equal(lireSession('pas du json'), null);
    assert.equal(lireSession(JSON.stringify({ url: 4 })), null);
    assert.equal(lireSession(null), null);
  });
});
