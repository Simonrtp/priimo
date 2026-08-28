import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { routeQuestion } from './router';

describe('routeQuestion — adresses', () => {
  it('reconnaît une adresse complète sans appeler de modèle', () => {
    const r = routeQuestion("Qu'est-ce qu'on sait du 27 rue Alphonse Penaud ?");
    assert.equal(r?.intent.type, 'immeuble');
    assert.equal(r?.intent.adresse, '27 rue Alphonse Penaud');
  });

  it('reconnaît une voie sans numéro', () => {
    const r = routeQuestion("Qu'est-ce que tu sais de la rue Vitruve ?");
    assert.equal(r?.intent.type, 'immeuble');
    assert.equal(r?.intent.adresse, 'rue Vitruve');
  });

  it('capte le code postal quand il est dit', () => {
    const r = routeQuestion('Qui est au 12 rue de la Monnaie, 59000 Lille ?');
    assert.equal(r?.intent.type, 'immeuble');
    assert.equal(r?.intent.adresse, '12 rue de la Monnaie');
    assert.equal(r?.intent.code_postal, '59000');
  });

  it('coupe la queue de phrase après le nom de voie', () => {
    const r = routeQuestion('Le mandat du 8 avenue de la République pour Martin');
    assert.equal(r?.intent.adresse, '8 avenue de la République');
  });
});

describe('routeQuestion — acquéreurs', () => {
  it('route « qui cherche » avec un code postal', () => {
    const r = routeQuestion('Qui cherche un appartement dans le 75020 ?');
    assert.equal(r?.intent.type, 'recherche_acquereur');
    assert.equal(r?.intent.code_postal, '75020');
    assert.equal(r?.intent.filtres.type_contact, 'acquereur');
  });

  it('route « quels acquéreurs pour » avec une adresse', () => {
    const r = routeQuestion('Quels acquéreurs pour le 15 rue des Pyrénées ?');
    assert.equal(r?.intent.type, 'recherche_acquereur');
    assert.equal(r?.intent.adresse, '15 rue des Pyrénées');
  });

  it('laisse la main au modèle sans secteur ni adresse', () => {
    assert.equal(routeQuestion('Qui cherche en ce moment ?'), null);
  });
});

describe('routeQuestion — activité', () => {
  it('compte sur une période nommée', () => {
    const r = routeQuestion('Combien de leads ce mois ?');
    assert.equal(r?.intent.type, 'activite');
    assert.equal(r?.intent.periode_jours, 30);
  });

  it('lit un nombre de jours explicite', () => {
    const r = routeQuestion("L'activité des 45 derniers jours");
    assert.equal(r?.intent.periode_jours, 45);
  });

  it('retombe sur la semaine sans période dite', () => {
    const r = routeQuestion("Qu'est-ce qu'on a fait ?");
    assert.equal(r?.intent.type, 'activite');
    assert.equal(r?.intent.periode_jours, 7);
  });

  it('plafonne à un an', () => {
    assert.equal(routeQuestion("L'activité des 900 derniers jours")?.intent.periode_jours, 365);
  });
});

describe('routeQuestion — personnes', () => {
  it('route « qui s’occupe de » vers la personne', () => {
    const r = routeQuestion("Qui s'occupe de Sophie Dubois ?");
    assert.equal(r?.intent.type, 'personne');
    assert.equal(r?.intent.nom, 'Sophie Dubois');
  });

  it('route « qui s’occupe du <adresse> » vers l’immeuble', () => {
    const r = routeQuestion("Qui s'occupe du 12 rue de la Monnaie ?");
    assert.equal(r?.intent.type, 'immeuble');
    assert.equal(r?.intent.adresse, '12 rue de la Monnaie');
  });

  it('route « le dossier X » vers la personne', () => {
    const r = routeQuestion('Tu as le dossier Martin ?');
    assert.equal(r?.intent.type, 'personne');
    assert.equal(r?.intent.nom, 'Martin');
  });
});

describe('routeQuestion — abstention', () => {
  it('rend null quand aucune forme sûre ne ressort', () => {
    assert.equal(routeQuestion('Quel temps fera-t-il demain à Paris ?'), null);
    assert.equal(routeQuestion('Tu peux me conseiller sur ma stratégie ?'), null);
    assert.equal(routeQuestion('ok'), null);
    assert.equal(routeQuestion(''), null);
  });

  it('ne fabrique pas un nom à partir de mots-outils', () => {
    assert.equal(routeQuestion("Qui s'occupe de ça ?"), null);
  });
});
