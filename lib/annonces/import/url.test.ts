import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { analyserUrl, cleImport } from './url';

describe('analyserUrl', () => {
  it('reconnaît PAP, SeLoger, Bien’ici, Leboncoin, Logic-Immo et Le Figaro', () => {
    assert.deepEqual(analyserUrl('https://www.pap.fr/annonces/appartement-paris-20e-75020-r462101331'), {
      portail: 'pap',
      idPortail: '462101331',
      url: 'https://www.pap.fr/annonces/appartement-paris-20e-75020-r462101331',
    });
    assert.equal(
      analyserUrl('https://www.seloger.com/annonces/achat/appartement/paris-20eme-75/gambetta/26B8QY8S7L4V.htm')?.idPortail,
      '26B8QY8S7L4V',
    );
    assert.equal(
      analyserUrl('https://www.bienici.com/annonce/vente/paris-20e-75020/appartement/ag754691-554208620')?.idPortail,
      'ag754691-554208620',
    );
    assert.equal(analyserUrl('https://www.leboncoin.fr/ad/ventes_immobilieres/2843918821')?.idPortail, '2843918821');
    assert.equal(analyserUrl('https://www.logic-immo.com/detail-vente-1a2b3c4d.htm?id=48213377')?.portail, 'logicimmo');
    assert.equal(analyserUrl('https://immobilier.lefigaro.fr/annonces/annonce-71234567.html')?.idPortail, '71234567');
  });

  it('reconnaît un programme SeLoger Neuf, sous ses deux formes d’URL', () => {
    assert.deepEqual(analyserUrl('https://www.selogerneuf.com/program/183494757/#m=hp_classifiedseocarousel'), {
      portail: 'seloger',
      idPortail: 'neuf-183494757',
      url: 'https://www.selogerneuf.com/program/183494757/',
    });
    assert.equal(analyserUrl('https://www.selogerneuf.com/annonces/neuf/programme/montrouge-92/242006217/')?.idPortail, 'neuf-242006217');
    assert.equal(analyserUrl('https://www.seloger.com/annonces/neuf/programme/montrouge-92/242006217/')?.idPortail, 'neuf-242006217');
  });

  it('nettoie les paramètres de suivi et accepte une URL noyée dans du texte', () => {
    const u = analyserUrl(
      'Regarde ça : https://www.pap.fr/annonces/appartement-paris-20e-75020-r462101331?utm_source=mail&xtor=EPR-1#photos merci',
    );
    assert.equal(u?.url, 'https://www.pap.fr/annonces/appartement-paris-20e-75020-r462101331');
    assert.equal(analyserUrl('m.leboncoin.fr/ad/ventes_immobilieres/2843918821')?.portail, 'leboncoin');
  });

  it('un autre site garde son URL comme clé, du texte sans URL est refusé', () => {
    const autre = analyserUrl('https://www.agence-du-village.fr/biens/appartement-3-pieces');
    assert.equal(autre?.portail, 'autre');
    assert.equal(cleImport(autre!), 'https://www.agence-du-village.fr/biens/appartement-3-pieces');
    assert.equal(analyserUrl('pas une url'), null);
  });

  it('refuse les adresses IP, les machines locales et les autres protocoles', () => {
    assert.equal(analyserUrl('http://169.254.169.254/latest/meta-data'), null);
    assert.equal(analyserUrl('http://[::1]/'), null);
    assert.equal(analyserUrl('http://intranet.local/annonce'), null);
    assert.equal(analyserUrl('ftp://www.pap.fr/annonces/x-r462101331'), null);
  });
});
