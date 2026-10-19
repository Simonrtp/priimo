import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ficheDepuisPage, lectureIncomplete } from './fiche';
import { chiffresDpeDuTexte, lireJsonLd, lireLeboncoin, lirePap, lireSeLoger, pageInexploitable, texteVisible } from './pages';
import { analyserUrl } from './url';

const FICHE_PAP = `
<h1 class="item-title no-margin-bottom"> Vente appartement 2 pièces 25 m² Paris 11E (75011)
  <span class="item-price "> 260.000 € </span> </h1>
<ul class="item-tags margin-bottom-20"><li> <strong>2 pièces</strong> </li> <li> <strong>1 chambre</strong> </li>
  <li> <strong>25,5 m²</strong> </li> </ul>
<div class="margin-bottom-30"> <p>Bel appartement situé au 2ème étage d'un immeuble ancien.</p></div>
<div class="energy-indice"><ul><li>A</li> <li class="active">E</li></ul></div>
<div class="ges-indice"><ul><li>A</li> <li class="active">C</li></ul></div>
<div id="carte_mappy" class="thunderforest map-annonce-adresse" data-thunderforest='{"center":["48.869042","2.372634"],"zoom":15}'></div>
`;

function pageSeLoger(classified: unknown): string {
  const json = JSON.stringify({ app_cldp: { data: { classified } } });
  return `<html><script>window["__UFRN_LIFECYCLE_SERVERREQUEST__"]=JSON.parse(${JSON.stringify(json)});</script></html>`;
}

const CLASSIFIED = {
  rawData: { propertyType: 'APARTMENT' },
  metadata: { creationDate: '2026-10-14T09:38:00Z' },
  contactSections: { contactCard: { title: 'Agence du Village' } },
  sections: {
    hardFacts: {
      facts: [
        { type: 'livingSpace', splitValue: '45' },
        { type: 'numberOfRooms', splitValue: '2' },
        { type: 'numberOfFloors', label: '5/7' },
      ],
      price: { value: '472 500 €' },
    },
    location: {
      address: { zipCode: '75020', city: 'Paris 20ème', district: 'Saint-Blaise' },
      geometry: { type: 'Point', coordinates: [2.4045, 48.8481] },
    },
    mainDescription: { description: 'Lumineux 2 pièces.' },
    energy: {
      features: [{ type: 'yearOfConstruction', value: '1930' }],
      certificates: [
        {
          scales: [
            { type: 'FR_ENERGY_AFTER_2021', efficiencyClass: { rating: 'D' }, values: [{ value: '214 kWh/m².an' }] },
            { type: 'FR_GHG_AFTER_2021', efficiencyClass: { rating: 'E' }, values: [{ value: '46 kg CO₂/m².an' }] },
          ],
        },
      ],
    },
  },
};

function pageLeboncoin(ad: unknown): string {
  return `<html><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: { ad } } })}</script></html>`;
}

const AD_LBC = {
  subject: 'Studio 16 m² Paris 20e',
  body: 'Studio au 6e étage. Consommation énergétique : 528 kWh/m²/an. Émissions : 20 kg CO2/m²/an.',
  price: [155000],
  first_publication_date: '2026-10-12 10:12:00',
  location: { zipcode: '75020', city: 'Paris', lat: 48.8562, lng: 2.3988 },
  owner: { type: 'private', name: 'Camille' },
  images: { urls_large: ['https://img.leboncoin.fr/a.jpg'] },
  attributes: [
    { key: 'real_estate_type', value: '2' },
    { key: 'square', value: '16' },
    { key: 'rooms', value: '1' },
    { key: 'energy_rate', value: 'g' },
    { key: 'ges', value: 'd' },
  ],
};

describe('lecteurs de pages', () => {
  it('PAP : prix, surface, lettres, point publié', () => {
    const p = lirePap(FICHE_PAP)!;
    assert.deepEqual(
      [p.prix, p.surface, p.pieces, p.etage, p.dpe, p.ges, p.codePostal, p.typeBien],
      [260_000, 25.5, 2, 2, 'E', 'C', '75011', 'appartement'],
    );
    assert.deepEqual(p.zone, { latitude: 48.869042, longitude: 2.372634, rayonM: 0 });
  });

  it('PAP rendu par un navigateur : le point de carte entre guillemets doubles', () => {
    const rendu = FICHE_PAP.replace(
      `data-thunderforest='{"center":["48.869042","2.372634"],"zoom":15}'`,
      'data-thunderforest="{&quot;center&quot;:[&quot;48.870358&quot;,&quot;2.384085&quot;],&quot;zoom&quot;:15}"',
    );
    assert.deepEqual(lirePap(rendu)!.zone, { latitude: 48.870358, longitude: 2.384085, rayonM: 0 });
  });

  it('SeLoger : conso et émissions chiffrées, point exact, agence', () => {
    const p = lireSeLoger(pageSeLoger(CLASSIFIED))!;
    assert.deepEqual(
      [p.prix, p.surface, p.pieces, p.etage, p.dpe, p.consoKwhM2, p.ges, p.gesKgM2, p.dpeApresJuillet2021],
      [472_500, 45, 2, 5, 'D', 214, 'E', 46, true],
    );
    assert.equal(p.typeVendeur, 'professionnel');
    assert.equal(p.agenceNom, 'Agence du Village');
    assert.deepEqual(p.zone, { latitude: 48.8481, longitude: 2.4045, rayonM: 0 });
  });

  it('Leboncoin : attributs, vendeur, position floutée en repère', () => {
    const p = lireLeboncoin(pageLeboncoin(AD_LBC))!;
    assert.deepEqual([p.prix, p.surface, p.pieces, p.dpe, p.ges, p.typeBien, p.typeVendeur], [155_000, 16, 1, 'G', 'D', 'appartement', 'particulier']);
    assert.deepEqual(p.zone, { latitude: 48.8562, longitude: 2.3988, rayonM: 800 });
    assert.deepEqual(p.photos, ['https://img.leboncoin.fr/a.jpg']);
  });

  it('Leboncoin agence : boutique, chauffage, année, quartier ; DPE « vierge » ignoré', () => {
    const ad = {
      ...AD_LBC,
      owner: { type: 'pro' },
      location: { ...AD_LBC.location, city_label: 'Paris 75020 Ménilmontant - Amandiers' },
      attributes: [
        ...AD_LBC.attributes.filter((a) => a.key !== 'energy_rate'),
        { key: 'energy_rate', value: 'v', value_label: 'Vierge' },
        { key: 'store_name', value: 'FREDēLION Gambetta' },
        { key: 'heating_mode', value: 'gas', value_label: 'Gaz' },
        { key: 'heating_type', value: 'individual', value_label: 'Individuel' },
        { key: 'building_year', value: '1903' },
      ],
    };
    const p = lireLeboncoin(pageLeboncoin(ad))!;
    assert.equal(p.agenceNom, 'FREDēLION Gambetta');
    assert.equal(p.chauffage, 'gaz individuel');
    assert.equal(p.anneeConstruction, 1903);
    assert.equal(p.quartier, 'Ménilmontant - Amandiers');
    assert.equal(p.dpe, null);
  });

  it('les chiffres du DPE écrits dans le texte, sans Mon assistant', () => {
    assert.deepEqual(
      chiffresDpeDuTexte(
        'Date de réalisation du diagnostic énergétique : 28/09/2026 Consommation énergie primaire : 352 kWh/m²/an Consommation énergie finale : 160 kWh/m²/an. Émissions de gaz à effet de serre : 71 kg CO2/m²/an',
      ),
      { consoKwhM2: 352, gesKgM2: 71, dateDpe: '2026-09-28' },
    );
    assert.deepEqual(chiffresDpeDuTexte('Bel appartement lumineux'), {});
  });

  it('schema.org : un site d’agence quelconque', () => {
    const html = `<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Apartment","name":"T3 Belleville","numberOfRooms":3,"floorSize":{"value":62},"address":{"postalCode":"75020","addressLocality":"Paris"},"geo":{"latitude":48.871,"longitude":2.385},"offers":{"@type":"Offer","price":"590000"}}]}</script>`;
    const p = lireJsonLd(html)!;
    assert.deepEqual([p.prix, p.surface, p.pieces, p.codePostal], [590_000, 62, 3, '75020']);
    assert.equal(p.zone!.rayonM, 300);
  });

  it('texte visible : sans scripts, les lignes utiles d’abord', () => {
    const t = texteVisible('<title>Annonce</title><script>var x=1</script><nav>Menu</nav><p>Consommation 528 kWh/m²/an</p>');
    assert.ok(t.includes('528 kWh') && !t.includes('var x') && !t.includes('Menu'));
  });

  it('repère une page de défi anti-robot ou une annonce retirée', () => {
    assert.equal(pageInexploitable('<html>' + 'x'.repeat(900) + 'captcha-delivery.com</html>'), 'bloquee');
    assert.equal(pageInexploitable('<html>' + 'x'.repeat(900) + 'Cette annonce a été supprimée</html>'), 'disparue');
  });
});

describe('ficheDepuisPage', () => {
  it('Leboncoin : les chiffres du DPE écrits dans le texte suffisent, Mon assistant n’est pas sollicité', async () => {
    const u = analyserUrl('https://www.leboncoin.fr/ad/ventes_immobilieres/2843918821')!;
    const html = pageLeboncoin(AD_LBC);
    assert.ok(lectureIncomplete(lireLeboncoin(html)!), 'rien dans les attributs');
    let appels = 0;
    const fiche = await ficheDepuisPage(u, html, async () => {
      appels += 1;
      return null;
    });
    assert.equal(appels, 0);
    assert.equal(fiche!.consoKwhM2, 528);
    assert.equal(fiche!.gesKgM2, 20);
    assert.equal(fiche!.zone!.rayonM, 800);
    assert.equal(fiche!.portail, 'leboncoin');
  });

  it('Leboncoin sans chiffres dans le texte : Mon assistant complète, la donnée structurée l’emporte', async () => {
    const u = analyserUrl('https://www.leboncoin.fr/ad/ventes_immobilieres/2843918821')!;
    const html = pageLeboncoin({ ...AD_LBC, body: 'Studio lumineux au 6e étage, DPE en pièce jointe.' });
    let lu = '';
    const fiche = await ficheDepuisPage(u, html, async (texte) => {
      lu = texte;
      return { conso_kwh_m2: 528, ges_kg_m2: 20, etage: 6, prix: 999 };
    });
    assert.ok(lu.includes('Studio lumineux'));
    assert.equal(fiche!.consoKwhM2, 528);
    assert.equal(fiche!.prix, 155_000, 'la donnée structurée l’emporte sur la lecture du texte');
  });

  it('SeLoger complet : Mon assistant n’est pas sollicité', async () => {
    const u = analyserUrl('https://www.seloger.com/annonces/achat/appartement/paris-20eme-75/26B8QY8S7L4V.htm')!;
    let appels = 0;
    const fiche = await ficheDepuisPage(u, pageSeLoger(CLASSIFIED), async () => {
      appels += 1;
      return null;
    });
    assert.equal(appels, 0);
    assert.equal(fiche!.consoKwhM2, 214);
  });
});
