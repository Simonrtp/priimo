import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ficheDepuisPage } from './fiche';
import { lireSeLogerNeuf } from './seloger-neuf';
import { analyserUrl } from './url';

/** Extrait de vraies pages selogerneuf.com (20/10/2026), réduit à ce que lit Priimo. */
function pageNeuf(annonce: Record<string, unknown>): string {
  const data = { props: { initialReduxState: { detailsAnnonce: { annonce } } }, page: '/detail' };
  return `<html><body><h1>${String(annonce.name)}</h1><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(data)}</script></body></html>`;
}

const LOTS = [
  { rooms: 3, propertyTypeId: 1, priceMin: 700000, propertiesByType: [{ id: 189999171, rooms: 3, livingArea: 76, price: 700000 }] },
  { rooms: 4, propertyTypeId: 1, priceMin: 857000, propertiesByType: [{ id: 189999172, rooms: 4, livingArea: 100, price: 857000 }] },
];

/** Forme « ssotGeoData » : adresse et point non flouté. */
const VILLA_LOUISA = {
  programId: 183494757,
  name: 'Villa Louisa',
  photos: [{ url: 'https://v.seloger.com/s/width/967/visuels/1/a.jpg', HDurl: 'https://v.seloger.com/s/width/1600/visuels/1/a.jpg' }],
  description: 'OPPORTUNITES en LIVRAISON IMMEDIATE 3 pièces en dernier étage : 77 m²',
  propertyTypes: LOTS,
  propertiesMinPrice: 700000,
  propertiesMaxPrice: 857000,
  professionalName: 'FRANCO SUISSE',
  creationDate: '2022-03-11T14:04:00',
  energyConsumption: null,
  ssotGeoData: {
    cityName: 'Suresnes',
    address: '15 Rue du Docteur Marc Bombiger',
    postalCode: '92150',
    coordinates: { lat: 48.86270126142551, lon: 2.212305304713817 },
    isRandomised: false,
  },
};

/** Forme « location » : adresse écrite, mais seulement le centre de la ville en coordonnées. */
const VILLA_ALEXANDRA = {
  programId: 242006217,
  name: 'Villa Alexandra',
  photos: [],
  propertyTypes: [
    { rooms: 3, propertyTypeId: 1, priceMin: 710000, propertiesByType: [{ rooms: 3, livingArea: 67, price: 710000 }] },
    { rooms: 2, propertyTypeId: 1, priceMin: 460500, propertiesByType: [{ rooms: 2, livingArea: 42, price: 460500 }] },
  ],
  propertiesMinPrice: 460500,
  professionalName: 'FRANCO SUISSE',
  location: {
    address: '116, avenue de la République',
    city: { cityName: 'Montrouge', zipCode: '92120', cityCoordinates: { lat: 48.815277, lon: 2.317354 } },
  },
};

describe('SeLoger Neuf', () => {
  it('programme : le lot le moins cher, le promoteur, l’adresse et le point non flouté', () => {
    const p = lireSeLogerNeuf(pageNeuf(VILLA_LOUISA))!;
    assert.equal(p.prix, 700_000);
    assert.equal(p.surface, 76);
    assert.equal(p.pieces, 3);
    assert.equal(p.typeBien, 'appartement');
    assert.equal(p.typeVendeur, 'professionnel');
    assert.equal(p.agenceNom, 'FRANCO SUISSE');
    assert.equal(p.titre, 'Programme neuf · Villa Louisa');
    assert.equal(p.codePostal, '92150');
    assert.equal(p.ville, 'Suresnes');
    assert.equal(p.adressePubliee, '15 Rue du Docteur Marc Bombiger');
    assert.deepEqual(p.zone, { latitude: 48.86270126142551, longitude: 2.212305304713817, rayonM: 0 });
    assert.equal(p.datePublication, '2022-03-11');
    assert.deepEqual(p.photos, ['https://v.seloger.com/s/width/1600/visuels/1/a.jpg']);
  });

  it('le centre de la ville n’est jamais pris pour le point du programme', () => {
    const p = lireSeLogerNeuf(pageNeuf(VILLA_ALEXANDRA))!;
    assert.equal(p.zone, null);
    assert.equal(p.adressePubliee, '116 avenue de la République');
    assert.equal(p.codePostal, '92120');
    assert.equal(p.prix, 460_500, 'les lots sont triés par prix');
    assert.equal(p.surface, 42);
    assert.equal(p.pieces, 2);
  });

  it('un point flouté par le site est écarté', () => {
    const p = lireSeLogerNeuf(pageNeuf({ ...VILLA_LOUISA, ssotGeoData: { ...VILLA_LOUISA.ssotGeoData, isRandomised: true } }))!;
    assert.equal(p.zone, null);
  });

  it('une page sans programme ne donne rien', () => {
    assert.equal(lireSeLogerNeuf('<html><body>Accueil</body></html>'), null);
  });
});

describe('ficheDepuisPage — programme neuf et relecture', () => {
  it('programme SeLoger Neuf : ni Mon assistant ni conso, l’adresse publiée devient le point', async () => {
    const u = analyserUrl('https://www.selogerneuf.com/annonces/neuf/programme/montrouge-92/242006217/')!;
    let appels = 0;
    let cherchee = '';
    const fiche = await ficheDepuisPage(
      u,
      pageNeuf(VILLA_ALEXANDRA),
      async () => {
        appels += 1;
        return null;
      },
      async (adresse, cp) => {
        cherchee = `${adresse} ${cp}`;
        return { latitude: 48.8163, longitude: 2.3189, rayonM: 0 };
      },
    );
    assert.equal(appels, 0);
    assert.equal(cherchee, '116 avenue de la République 92120');
    assert.equal(fiche!.idPortail, 'neuf-242006217');
    assert.equal(fiche!.prix, 460_500);
    assert.deepEqual(fiche!.zone, { latitude: 48.8163, longitude: 2.3189, rayonM: 0 });
  });

  it('une adresse retrouvée loin du point publié ne le remplace pas', async () => {
    const u = analyserUrl('https://www.selogerneuf.com/program/183494757/')!;
    const fiche = await ficheDepuisPage(u, pageNeuf(VILLA_LOUISA), async () => null, async () => ({ latitude: 48.9, longitude: 2.3, rayonM: 0 }));
    assert.equal(fiche!.zone!.latitude, 48.86270126142551);
  });

  it('Mon assistant rend prix et surface vides : il est relu une fois', async () => {
    const u = analyserUrl('https://www.agence-du-village.fr/biens/appartement-3-pieces')!;
    const html = `<html><body>${'Bel appartement. '.repeat(80)}</body></html>`;
    const reponses = [
      { prix: null, surface: null, code_postal: '75020' },
      { prix: 512_000, surface: 61, code_postal: '75020' },
    ];
    let appels = 0;
    const fiche = await ficheDepuisPage(u, html, async () => reponses[appels++] ?? null);
    assert.equal(appels, 2);
    assert.equal(fiche!.prix, 512_000);
    assert.equal(fiche!.surface, 61);
  });

  it('page sans annonce : rien, après deux lectures au plus', async () => {
    const u = analyserUrl('https://www.agence-du-village.fr/contact')!;
    let appels = 0;
    const fiche = await ficheDepuisPage(u, `<html><body>${'Contactez-nous. '.repeat(80)}</body></html>`, async () => {
      appels += 1;
      return { prix: null, surface: null };
    });
    assert.equal(appels, 2);
    assert.equal(fiche, null);
  });
});
