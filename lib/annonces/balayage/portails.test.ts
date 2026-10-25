import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ficheDisparue,
  lieuSeLoger,
  lirePagePap,
  lirePageSeLoger,
  pageSeLoger,
  pageSuivantePap,
  premierePagePap,
  refusDemarchage,
} from './portails';

/** Une carte PAP telle que la page « vente immobilière » l'écrit (25/10/2026). */
function cartePap(chemin: string, lieu: string, prix = '415.000&nbsp;&euro;', dpe = 'c') {
  return `<div class="search-list-item-alt" data-x="1">
  <div class="item-thumb-dpe item-thumb-dpe-${dpe}"></div>
  <div class="item-body">
  <a class="item-title" href="${chemin}" name="1">
    <div class="item-price-container"><span class="item-price txt-indigo">
      ${prix}					</span></div>
    <span class="h1">
      ${lieu}									</span>
    <ul class="item-tags">
      <li>2&nbsp;pièces</li>
      <li>1&nbsp;chambre</li>
      <li>37&nbsp;m²</li>
    </ul>
  </a></div></div>`;
}

function pageSeLogerHtml(classifieds: string[], fiches: Record<string, unknown>, total = 1374) {
  const json = JSON.stringify({ data: { 'classified-serp-data': { totalCount: total, classifieds, classifiedsData: fiches } } });
  return `<html><script>window["__UFRN_FETCHER__"]=JSON.parse(${JSON.stringify(json)});</script></html>`;
}

describe('lieux des portails', () => {
  it('Paris : PAP et SeLoger suivent l’arrondissement', () => {
    assert.equal(premierePagePap('75011'), 'https://www.pap.fr/annonce/vente-immobiliere-paris-11e-g37778');
    assert.equal(premierePagePap('75020'), 'https://www.pap.fr/annonce/vente-immobiliere-paris-20e-g37787');
    assert.equal(lieuSeLoger('75005'), 'POCOFR4799');
    assert.equal(lieuSeLoger('75020'), 'POCOFR4814');
  });
  it('hors Paris : SeLoger relevé, PAP pas encore ; un code inconnu n’est pas deviné', () => {
    assert.equal(premierePagePap('74500'), null);
    assert.equal(lieuSeLoger('74500'), 'POCOFR4774');
    assert.equal(lieuSeLoger('13001'), null);
    assert.equal(premierePagePap('75116'), null);
  });
  it('SeLoger : les plus récentes d’abord, page en paramètre', () => {
    assert.match(pageSeLoger('POCOFR4805', 1), /order=DateDesc$/);
    assert.match(pageSeLoger('POCOFR4805', 3), /order=DateDesc&page=3$/);
  });
});

describe('lirePagePap', () => {
  it('lit prix, surface, pièces, DPE et code postal d’un logement', () => {
    const [c] = lirePagePap(cartePap('/annonces/appartement-paris-11e-r465801644', 'Paris 11E'));
    assert.deepEqual(c, {
      portail: 'pap',
      idPortail: '465801644',
      url: 'https://www.pap.fr/annonces/appartement-paris-11e-r465801644',
      codePostal: '75011',
      prix: 415000,
      surface: 37,
      pieces: 2,
      dpe: 'C',
      typeBien: 'appartement',
      creeeLe: null,
    });
  });
  it('écarte parkings, locaux et fonds de commerce ; garde les maisons', () => {
    const html = [
      cartePap('/annonces/garage-parking-paris-11e-75011-r465000133', 'Paris 11E (75011)', '24.500&nbsp;&euro;'),
      cartePap('/annonces/fonds-de-commerce-paris-11e-r465000001', 'Paris 11E'),
      cartePap('/annonces/maison-paris-20e-r465000002', 'Paris 20E'),
    ].join('');
    assert.deepEqual(lirePagePap(html).map((c) => [c.idPortail, c.typeBien]), [['465000002', 'maison']]);
  });
  it('code postal : entre parenthèses, ou l’arrondissement, sans la mention « à 2 km de »', () => {
    const html = cartePap('/annonces/appartement-bagnolet-r1234567', 'Bagnolet (93170)') + cartePap('/annonces/appartement-paris-20e-r7654321', 'Paris 20E à 2km de Paris 11e');
    assert.deepEqual(lirePagePap(html).map((c) => c.codePostal), ['93170', '75020']);
  });
});

describe('pageSuivantePap', () => {
  it('suit « Suivante » dans le code postal, s’arrête aux communes voisines', () => {
    assert.equal(
      pageSuivantePap('<a id="pagination-next" href="/annonce/logement-vendre-paris-11e-g37778-10">Suivante</a>'),
      'https://www.pap.fr/annonce/logement-vendre-paris-11e-g37778-10',
    );
    assert.equal(pageSuivantePap('<a id="pagination-next" href="/proximite/logement-vendre-paris-20e-g37787-10">Suivante</a>'), null);
    assert.equal(pageSuivantePap('<ul id="pagination"></ul>'), null);
  });
});

describe('lirePageSeLoger', () => {
  const fiches = {
    A1B2C3D4E5F6: {
      type: 'PRIVATE',
      url: 'https://www.seloger.com/annonce/achat/ile-de-france/paris-75/paris-75000/A1B2C3D4E5F6',
      rawData: { price: 405000, surface: { main: 36 }, nbroom: 2, propertyType: 'Apartment' },
      location: { address: { zipCode: '75011' } },
      energyClass: 'E',
      metadata: { creationDate: '2026-10-24T17:48:21Z' },
    },
    PRO000000001: {
      type: 'PROFESSIONAL',
      url: '/annonce/achat/ile-de-france/paris-75/paris-75000/PRO000000001',
      rawData: { price: 600000 },
      metadata: { creationDate: '2026-10-25T08:00:00Z' },
    },
  };
  it('garde les particuliers, compte toutes les annonces et leurs dates', () => {
    const r = lirePageSeLoger(pageSeLogerHtml(['A1B2C3D4E5F6', 'PRO000000001'], fiches));
    assert.equal(r.lisible, true);
    assert.equal(r.total, 1374);
    assert.equal(r.annonces, 2);
    assert.deepEqual(r.datesCreation, ['2026-10-24T17:48:21Z', '2026-10-25T08:00:00Z']);
    assert.deepEqual(r.cartes, [
      {
        portail: 'seloger',
        idPortail: 'A1B2C3D4E5F6',
        url: 'https://www.seloger.com/annonce/achat/ile-de-france/paris-75/paris-75000/A1B2C3D4E5F6',
        codePostal: '75011',
        prix: 405000,
        surface: 36,
        pieces: 2,
        dpe: 'E',
        typeBien: 'appartement',
        creeeLe: '2026-10-24T17:48:21Z',
      },
    ]);
  });
  it('une page sans les données (captcha, refonte) est dite illisible', () => {
    assert.equal(lirePageSeLoger('<html>Please enable JS</html>').lisible, false);
  });
});

describe('fiches', () => {
  it('retirée : PAP sans titre d’annonce, SeLoger sans données d’annonce', () => {
    assert.equal(ficheDisparue('pap', '<h1 class="item-title no-margin-bottom">Vente appartement</h1>'), false);
    assert.equal(ficheDisparue('pap', '<h1 class="h3">Vente Logement Paris 11e</h1>'), true);
    assert.equal(ficheDisparue('seloger', '<script>window["__UFRN_LIFECYCLE_SERVERREQUEST__"]=1</script>'), false);
    assert.equal(ficheDisparue('seloger', '<html>résultats</html>'), true);
  });
  it('repère le refus de démarchage', () => {
    assert.equal(refusDemarchage('Le propriétaire refuse le démarchage commercial.'), true);
    assert.equal(refusDemarchage('Agences s’abstenir'), false);
  });
});
