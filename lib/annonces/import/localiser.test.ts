import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  adressesPossibles,
  chercherCandidats,
  decider,
  etageDpe,
  localiserFiche,
  pireLettre,
  requetesDpe,
  rueCitee,
  rueDepuisTexte,
  scorerCandidat,
  type LigneDpe,
} from './localiser';
import type { FicheAnnonce } from './types';

function fiche(over: Partial<FicheAnnonce> = {}): FicheAnnonce {
  return {
    portail: 'bienici',
    idPortail: 'ag1',
    url: 'https://www.bienici.com/annonce/ag1',
    typeVendeur: 'professionnel',
    agenceNom: 'Agence du Village',
    typeBien: 'appartement',
    titre: null,
    prix: 310_000,
    surface: 32,
    pieces: 2,
    etage: 5,
    dpe: 'E',
    consoKwhM2: 297,
    ges: 'B',
    gesKgM2: 11,
    dpeApresJuillet2021: true,
    dateDpe: null,
    anneeConstruction: null,
    chauffage: null,
    codePostal: '75020',
    ville: 'Paris 20e',
    quartier: null,
    description: 'Charmant 2 pièces au 5e étage sans ascenseur, rue Mouraud.',
    datePublication: '2026-09-03T08:30:14Z',
    zone: null,
    photos: [],
    ...over,
  };
}

function dpe(over: LigneDpe = {}): LigneDpe {
  return {
    numero_dpe: 'D1',
    adresse_ban: '46 Rue Mouraud 75020 Paris',
    _geopoint: '48.8553,2.4088',
    type_batiment: 'appartement',
    surface_habitable_logement: 31.9,
    complement_adresse_logement: 'Bât A; Etage 5',
    etiquette_dpe: 'E',
    conso_5_usages_par_m2_ep: 297,
    etiquette_ges: 'B',
    emission_ges_5_usages_par_m2: 11,
    date_etablissement_dpe: '2026-08-29',
    ...over,
  };
}

describe('requetesDpe — la règle de précision', () => {
  it('cherche dans le code postal seulement avec la conso, serrée à ±1,5, émissions et surface comprises', () => {
    const [serree, sansSurface] = requetesDpe(fiche());
    assert.equal(serree!.portee, 'code_postal');
    assert.deepEqual(serree!.params, {
      code_postal_ban_eq: '75020',
      conso_5_usages_par_m2_ep_gte: '295.5',
      conso_5_usages_par_m2_ep_lte: '298.5',
      emission_ges_5_usages_par_m2_gte: '9.5',
      emission_ges_5_usages_par_m2_lte: '12.5',
      surface_habitable_logement_gte: '29',
      surface_habitable_logement_lte: '35',
    });
    assert.equal(sansSurface!.params.surface_habitable_logement_gte, undefined);
  });

  it('jamais la surface seule sur tout un code postal', () => {
    assert.deepEqual(requetesDpe(fiche({ consoKwhM2: null, gesKgM2: null })), []);
  });

  it('sans conso, la surface seulement dans un repère publié de 250 m au plus', () => {
    const proche = requetesDpe(fiche({ consoKwhM2: null, zone: { latitude: 48.85, longitude: 2.4, rayonM: 50 } }));
    assert.equal(proche.length, 1);
    assert.equal(proche[0]!.params.geo_distance, '2.4,48.85,170');
    assert.equal(proche[0]!.params.etiquette_dpe_eq, 'E');
    assert.deepEqual(requetesDpe(fiche({ consoKwhM2: null, zone: { latitude: 48.85, longitude: 2.4, rayonM: 800 } })), []);
  });

  it('sans conso, un quartier avec lettre DPE jusqu’à 650 m', () => {
    const q = requetesDpe(
      fiche({ consoKwhM2: null, gesKgM2: null, zone: { latitude: 48.85, longitude: 2.4, rayonM: 400 } }),
    );
    assert.equal(q.length, 1);
    assert.equal(q[0]!.params.geo_distance, '2.4,48.85,520');
    assert.equal(q[0]!.params.etiquette_dpe_eq, 'E');
    assert.deepEqual(
      requetesDpe(fiche({ consoKwhM2: null, dpe: null, zone: { latitude: 48.85, longitude: 2.4, rayonM: 400 } })),
      [],
    );
  });

  it('une conso hors de sa classe est une faute de saisie, un DPE d’avant 2021 n’est pas comparable', () => {
    assert.deepEqual(requetesDpe(fiche({ consoKwhM2: 900, dpe: 'C', gesKgM2: null })), []);
    assert.deepEqual(requetesDpe(fiche({ dpeApresJuillet2021: false })), []);
  });
});

describe('score et décision', () => {
  it('lit l’étage dans le complément, pas le 0 par défaut', () => {
    assert.equal(etageDpe({ complement_adresse_logement: 'Esc. D; Etage 2' }), 2);
    assert.equal(etageDpe({ complement_adresse_logement: 'RDC gauche' }), 0);
    assert.equal(etageDpe({ numero_etage_appartement: 0 }), null);
  });

  it('reconnaît la voie donnée comme adresse, pas un repère', () => {
    assert.equal(rueCitee('46 Rue Mouraud 75020 Paris', 'situé rue Mouraud au 5e'), true);
    assert.equal(rueCitee('46 Rue Mouraud 75020 Paris', 'à deux pas de la rue Mouraud'), false);
  });

  it('extrait la rue écrite comme adresse, pas un quartier ni un repère', () => {
    assert.equal(rueDepuisTexte('Situé rue Mouraud au 5e étage'), 'rue Mouraud');
    assert.equal(rueDepuisTexte('12 rue Oberkampf, 3 pièces 71 m²'), '12 rue Oberkampf');
    assert.equal(rueDepuisTexte('à deux pas de la rue Mouraud'), null);
    assert.equal(rueDepuisTexte('République-Saint Ambroise'), null);
  });

  it('le bon logement devance nettement les autres : adresse certaine', () => {
    const bon = dpe();
    const voisin = dpe({ numero_dpe: 'D2', adresse_ban: '37 Rue des Rasselins 75020 Paris', surface_habitable_logement: 30.9, conso_5_usages_par_m2_ep: 300, complement_adresse_logement: 'Etage 2' });
    const d = decider(fiche(), [voisin, bon], 'code_postal');
    assert.equal(d.statut, 'certaine');
    assert.equal(d.meilleur!.dpe.numero_dpe, 'D1');
    assert.ok(scorerCandidat(fiche(), bon).raisons.some((r) => r.includes('conso 297')));
  });

  it('deux logements jumeaux dans deux immeubles : pas d’adresse', () => {
    const a = dpe();
    const b = dpe({ numero_dpe: 'D3', adresse_ban: '12 Rue Orfila 75020 Paris' });
    const sansIndice = fiche({ description: null, etage: null });
    assert.equal(decider(sansIndice, [a, b], 'code_postal').statut, 'incertaine');
  });

  it('dans tout un code postal sans émissions chiffrées, « probable » ne suffit pas', () => {
    const f = fiche({ gesKgM2: null, ges: null, etage: null, description: null });
    const a = dpe({ etiquette_ges: null });
    const b = dpe({ numero_dpe: 'D4', adresse_ban: '3 Rue Orfila 75020 Paris', surface_habitable_logement: 35.5, etiquette_ges: null });
    const d = decider(f, [a, b], 'code_postal');
    assert.notEqual(d.statut, 'probable');
  });
});

describe('localiserFiche — pas de quartier à la place d’une rue', () => {
  it('sans DPE, n’affiche pas le nom de quartier comme une adresse', async () => {
    const fetcher = async () => ({ ok: true, json: async () => ({ results: [] }) });
    const loc = await localiserFiche(
      fiche({
        consoKwhM2: null,
        gesKgM2: null,
        quartier: 'République-Saint Ambroise',
        zone: { latitude: 48.866, longitude: 2.373, rayonM: 480 },
      }),
      fetcher,
    );
    assert.equal(loc.adresse, null);
    assert.equal(loc.confiance, 'incertaine');
  });

  it('tous les DPE du secteur dans la même rue : on affiche la rue', async () => {
    const fetcher = async () => ({
      ok: true,
      json: async () => ({
        results: [
          dpe({
            adresse_ban: '12 Rue Oberkampf 75011 Paris',
            _geopoint: '48.8640,2.3700',
            complement_adresse_logement: 'Etage 2',
          }),
          dpe({
            numero_dpe: 'D2',
            adresse_ban: '18 Rue Oberkampf 75011 Paris',
            _geopoint: '48.8642,2.3704',
            complement_adresse_logement: 'Etage 4',
          }),
        ],
      }),
    });
    const loc = await localiserFiche(
      fiche({
        consoKwhM2: null,
        gesKgM2: null,
        etage: null,
        description: null,
        quartier: 'République-Saint Ambroise',
        zone: { latitude: 48.864, longitude: 2.37, rayonM: 400 },
      }),
      fetcher,
    );
    assert.match(loc.adresse ?? '', /Rue Oberkampf/i);
    assert.ok(loc.rayonM != null && loc.rayonM <= 180);
    assert.equal(loc.confiance, 'incertaine');
  });
});

describe('chercherCandidats', () => {
  it('élargit à la conso seule quand la surface ne ramène rien', async () => {
    const urls: string[] = [];
    const fetcher = async (url: string) => {
      urls.push(url);
      const avecSurface = url.includes('surface_habitable_logement_gte');
      return { ok: true, json: async () => ({ results: avecSurface ? [] : [dpe()] }) };
    };
    const { lignes, portee } = await chercherCandidats(fiche(), fetcher);
    assert.equal(lignes.length, 1);
    assert.equal(portee, 'code_postal');
    assert.equal(urls.length, 2);
    assert.ok(!urls.some((u) => u.includes('qs=')), 'le WAF de l’ADEME refuse qs');
  });
});

describe('garde-fous de l’audit du 21/10/2026 (cas réels)', () => {
  it('l’étiquette du DPE est la pire des classes énergie et climat (SeLoger affiche E, GES F → F)', () => {
    assert.equal(pireLettre('E', 'F'), 'F');
    assert.equal(pireLettre('D', 'B'), 'D');
    assert.equal(pireLettre(null, 'C'), 'C');
    const f = fiche({ dpe: 'E', consoKwhM2: 325, ges: 'F', gesKgM2: 69, surface: 92, etage: null });
    const { raisons } = scorerCandidat(f, dpe({ etiquette_dpe: 'F', conso_5_usages_par_m2_ep: 325, etiquette_ges: 'F', emission_ges_5_usages_par_m2: 69, surface_habitable_logement: 92 }));
    assert.ok(raisons.some((r) => r.startsWith('+5 étiquette DPE F')), raisons.join(' ; '));
  });

  it('lit l’étage sans le mot « étage » : « BAT E 7EME GAUCHE », « R+3 »', () => {
    assert.equal(etageDpe(dpe({ complement_adresse_logement: 'BAT E 7EME GAUCHE' })), 7);
    assert.equal(etageDpe(dpe({ complement_adresse_logement: 'Etage R+3 ; Porte 0010' })), 3);
  });

  it('un quartier publié ET tout le code postal sont fouillés', () => {
    const r = requetesDpe(fiche({ zone: { latitude: 48.852, longitude: 2.3957, rayonM: 281 }, codePostal: '75011' }));
    assert.deepEqual(
      r.map((q) => q.portee),
      ['zone', 'zone', 'code_postal', 'code_postal'],
    );
    assert.equal(r[2]!.params.code_postal_ban_eq, '75011');
  });

  it('toutes les requêtes sont réunies, sans doublon, même si la première répond', async () => {
    const urls: string[] = [];
    const fetcher = async (url: string) => {
      urls.push(url);
      return { ok: true, json: async () => ({ results: [dpe({ numero_dpe: url.includes('geo_distance') ? 'Z' : 'C' })] }) };
    };
    const { lignes, portee } = await chercherCandidats(fiche({ zone: { latitude: 48.85, longitude: 2.4, rayonM: 300 } }), fetcher);
    assert.equal(urls.length, 4);
    assert.deepEqual(lignes.map((l) => l.numero_dpe).sort(), ['C', 'Z']);
    assert.equal(portee, 'zone');
  });

  it('jamais d’adresse dans un autre code postal que l’annonce (58 bd de Charonne 75020 pour une annonce 75011)', () => {
    const f = fiche({ codePostal: '75011', zone: { latitude: 48.852, longitude: 2.3957, rayonM: 281 } });
    const d = decider(f, [dpe({ adresse_ban: '58 Boulevard de Charonne 75020 Paris', code_postal_ban: '75020', _geopoint: '48.8525,2.3960' })], 'zone');
    assert.equal(d.statut, 'incertaine');
  });

  it('une surface à plus de 6 m² n’est jamais affirmée (41,7 m² pour 88)', () => {
    const f = fiche({ surface: 88, codePostal: '75020' });
    const d = decider(f, [dpe({ surface_habitable_logement: 41.7, code_postal_ban: '75020' })], 'code_postal');
    assert.equal(d.statut, 'incertaine');
  });

  it('hors du repère publié : au mieux probable à 200 m, jamais affirmé au-delà de 400 m', () => {
    const zone = { latitude: 48.86521, longitude: 2.371655, rayonM: 269 };
    const f = fiche({ codePostal: '75020', zone, etage: 5 });
    const proche = decider(f, [dpe({ code_postal_ban: '75020', _geopoint: '48.8608,2.3700' })], 'zone'); // ~ 220 m hors du cercle
    assert.notEqual(proche.statut, 'certaine');
    const loin = decider(f, [dpe({ code_postal_ban: '75020', _geopoint: '48.8400,2.3700' })], 'zone'); // ~ 2 km
    assert.equal(loin.statut, 'incertaine');
  });

  it('jumeau d’un autre immeuble (banc du 22/10/2026) : « sûre » exige la surface à 1,5 m² et l’étage non contredit', () => {
    const f = fiche({ surface: 36, etage: 2, codePostal: '75020' });
    const pres = decider(f, [dpe({ surface_habitable_logement: 35.4, complement_adresse_logement: 'Etage 2', code_postal_ban: '75020' })], 'code_postal');
    assert.equal(pres.statut, 'certaine');
    // 36 m² pour 33,1 (Carrez contre habitable, rue Saint-Maur) : l’étage confirmé garde l’adresse, en « probable ».
    const carrez = decider(f, [dpe({ surface_habitable_logement: 33.1, complement_adresse_logement: 'Etage 2', code_postal_ban: '75020' })], 'code_postal');
    assert.equal(carrez.statut, 'probable');
    // Même écart sans étage lisible, ou avec un autre étage : rien n’est affirmé.
    const sansEtage = decider(f, [dpe({ surface_habitable_logement: 33.1, complement_adresse_logement: null, code_postal_ban: '75020' })], 'code_postal');
    assert.equal(sansEtage.statut, 'incertaine');
    const autreEtage = decider(f, [dpe({ surface_habitable_logement: 35.6, complement_adresse_logement: 'Etage 4', code_postal_ban: '75020' })], 'code_postal');
    assert.equal(autreEtage.statut, 'incertaine');
  });

  it('hors du cercle publié, l’étage doit être confirmé', () => {
    const zone = { latitude: 48.86521, longitude: 2.371655, rayonM: 269 };
    const horsCercle = { code_postal_ban: '75020', _geopoint: '48.8608,2.3700', surface_habitable_logement: 31.9 }; // ~ 220 m hors du cercle
    assert.equal(decider(fiche({ codePostal: '75020', zone, etage: null }), [dpe(horsCercle)], 'zone').statut, 'incertaine');
    assert.equal(decider(fiche({ codePostal: '75020', zone, etage: 5 }), [dpe(horsCercle)], 'zone').statut, 'probable');
  });

  it('empreinte des dépenses d’énergie : 73 bd Richard Lenoir retrouvé, « 5 rue Titon » écarté (cas réels)', () => {
    // 75 m² à l’annonce, 71,5 m² au DPE, étage illisible : sans l’empreinte, rien n’était affirmé.
    const lenoir = fiche({ surface: 75, etage: 2, dpe: 'E', consoKwhM2: 241, ges: 'E', gesKgM2: 59, codePostal: '75011', depensesEnergie: { min: 2320, max: 3180 } });
    const d1 = decider(lenoir, [dpe({ adresse_ban: '73 Boulevard Richard Lenoir 75011 Paris', code_postal_ban: '75011', surface_habitable_logement: 71.5, complement_adresse_logement: '1-Bâtiment n°1-1-LogZone', etiquette_dpe: 'E', conso_5_usages_par_m2_ep: 241.5, etiquette_ges: 'E', emission_ges_5_usages_par_m2: 59, cout_total_5_usages: 2750 })], 'code_postal');
    assert.equal(d1.statut, 'certaine');
    // Studio au 11e : le DPE d’un 1er étage, 909 €/an pour 778 au milieu de la fourchette.
    const titon = fiche({ surface: 31, etage: 11, dpe: 'D', consoKwhM2: 234, ges: 'D', gesKgM2: 33, codePostal: '75011', depensesEnergie: { min: 667, max: 890 } });
    const d2 = decider(titon, [dpe({ adresse_ban: '5 Rue Titon 75011 Paris', code_postal_ban: '75011', surface_habitable_logement: 31.2, complement_adresse_logement: null, etiquette_dpe: 'D', conso_5_usages_par_m2_ep: 233.3, etiquette_ges: 'D', emission_ges_5_usages_par_m2: 32, cout_total_5_usages: 909.3 })], 'code_postal');
    assert.equal(d2.statut, 'incertaine');
  });

  it('un coût qui coïncide ne pèse rien contre un GES contraire (« 10 rue Émile Lepeu », 23/10/2026)', () => {
    const titon = fiche({ surface: 31, etage: 11, dpe: 'D', consoKwhM2: 234, ges: 'D', gesKgM2: 33, codePostal: '75011', depensesEnergie: { min: 667, max: 890 } });
    const lepeu = dpe({ adresse_ban: '10 Rue Emile Lepeu 75011 Paris', code_postal_ban: '75011', surface_habitable_logement: 32, complement_adresse_logement: null, etiquette_dpe: 'D', conso_5_usages_par_m2_ep: 236.6, etiquette_ges: 'D', emission_ges_5_usages_par_m2: 49.3, cout_total_5_usages: 783 });
    assert.equal(decider(titon, [lepeu], 'code_postal').statut, 'incertaine');
    assert.deepEqual(adressesPossibles(titon, [lepeu]), []);
  });

  it('même coût, conso à 3 kWh : probable, pas sûre (55 bd de Charonne)', () => {
    const f = fiche({ surface: 42.12, etage: null, dpe: 'D', consoKwhM2: 172, ges: 'D', gesKgM2: 36, codePostal: '75011', depensesEnergie: { min: 580, max: 830 } });
    const d = decider(f, [dpe({ adresse_ban: '55 Boulevard de Charonne 75011 Paris', code_postal_ban: '75011', surface_habitable_logement: 42.3, complement_adresse_logement: 'Etage 1', etiquette_dpe: 'D', conso_5_usages_par_m2_ep: 175, etiquette_ges: 'D', emission_ges_5_usages_par_m2: 37, cout_total_5_usages: 710 })], 'code_postal');
    assert.equal(d.statut, 'probable');
  });

  it('même date de diagnostic et même coût : identité prouvée malgré la surface annoncée (Annecy, 23/10/2026)', () => {
    const f = fiche({ surface: 183, etage: 3, dpe: 'D', consoKwhM2: 192, ges: 'B', gesKgM2: null, dateDpe: '2025-04-16', codePostal: '74000', zone: { latitude: 45.8995, longitude: 6.1262, rayonM: 800 }, depensesEnergie: { min: 1978, max: 2677 } });
    const filaterie = dpe({ adresse_ban: '10 Rue Filaterie 74000 Annecy', code_postal_ban: '74000', _geopoint: '45.8990,6.1270', surface_habitable_logement: 122, complement_adresse_logement: 'Etage : 3ème', etiquette_dpe: 'D', conso_5_usages_par_m2_ep: 192.1, etiquette_ges: 'B', emission_ges_5_usages_par_m2: 7, cout_total_5_usages: 2327, date_etablissement_dpe: '2025-04-16' });
    assert.equal(decider(f, [filaterie], 'zone').statut, 'certaine');
    // Sans la date, une surface à 61 m² reste un autre logement.
    assert.equal(decider({ ...f, dateDpe: null }, [filaterie], 'zone').statut, 'incertaine');
  });

  it('Leboncoin en lettres seules : la fourchette des dépenses cherche dans tout le code postal et départage', async () => {
    const f = fiche({ consoKwhM2: null, gesKgM2: null, dpe: 'D', ges: 'D', surface: 76, etage: 4, codePostal: '74100', zone: { latitude: 46.19, longitude: 6.237, rayonM: 800 }, depensesEnergie: { min: 1150, max: 1570 } });
    const requetes = requetesDpe(f);
    assert.ok(requetes.some((r) => r.params.code_postal_ban_eq === '74100' && r.params.cout_total_5_usages_gte === '1346.4' && r.params.cout_total_5_usages_lte === '1373.6'));
    const bon = dpe({ numero_dpe: 'B', adresse_ban: '12 Rue du Parc 74100 Annemasse', code_postal_ban: '74100', _geopoint: '46.1912,6.2380', surface_habitable_logement: 75.8, complement_adresse_logement: 'Etage 4', etiquette_dpe: 'D', conso_5_usages_par_m2_ep: 180, etiquette_ges: 'D', emission_ges_5_usages_par_m2: 38, cout_total_5_usages: 1362 });
    const sosie = dpe({ numero_dpe: 'S', adresse_ban: '3 Rue Faucigny 74100 Annemasse', code_postal_ban: '74100', _geopoint: '46.1930,6.2350', surface_habitable_logement: 76.4, complement_adresse_logement: null, etiquette_dpe: 'D', conso_5_usages_par_m2_ep: 181, etiquette_ges: 'D', emission_ges_5_usages_par_m2: 38, cout_total_5_usages: 1376 });
    const d = decider(f, [bon, sosie], 'zone');
    assert.equal(d.statut, 'certaine');
    assert.equal(d.meilleur?.dpe.adresse_ban, '12 Rue du Parc 74100 Annemasse');
  });

  it('point retrouvé par les écoles (rayon 35 m) : le DPE au point est affirmé, un jumeau à 190 m jamais', () => {
    const zone = { latitude: 48.854232, longitude: 2.375375, rayonM: 35 }; // 12 rue des Taillandiers
    const f = fiche({ surface: 41.44, etage: 3, dpe: 'D', consoKwhM2: 241, ges: 'B', gesKgM2: 9, codePostal: '75011', zone });
    const auPoint = dpe({ adresse_ban: '12 Rue des Taillandiers 75011 Paris', code_postal_ban: '75011', _geopoint: '48.85430,2.37530', surface_habitable_logement: 41.4, complement_adresse_logement: 'Etage 3', etiquette_dpe: 'D', conso_5_usages_par_m2_ep: 241, etiquette_ges: 'B', emission_ges_5_usages_par_m2: 9 });
    assert.equal(decider(f, [auPoint], 'zone').statut, 'certaine');
    // 24 rue de Lappe : même logement trait pour trait, mais à 190 m du point.
    const jumeau = dpe({ ...auPoint, numero_dpe: 'J', adresse_ban: '24 Rue de Lappe 75011 Paris', _geopoint: '48.853511,2.373006' });
    assert.equal(decider(f, [jumeau], 'zone').statut, 'incertaine');
  });

  it('l’adresse publiée au point près n’a pas besoin de la surface exacte', () => {
    const f = fiche({ surface: 36, etage: null, codePostal: '75020', zone: { latitude: 48.8553, longitude: 2.4088, rayonM: 0 } });
    const d = decider(f, [dpe({ surface_habitable_logement: 33.1, code_postal_ban: '75020' })], 'zone');
    assert.equal(d.statut, 'certaine');
  });

  it('un seul DPE faible dans une rue ne fait pas « la rue »', async () => {
    const fetcher = async () => ({ ok: true, json: async () => ({ results: [dpe({ adresse_ban: '17 Rue de Lappe 75011 Paris', _geopoint: '48.8530,2.3720' })] }) });
    const loc = await localiserFiche(
      fiche({ consoKwhM2: null, gesKgM2: null, etage: null, description: null, zone: { latitude: 48.853, longitude: 2.372, rayonM: 400 } }),
      fetcher,
    );
    assert.equal(loc.adresse, null);
  });
});

describe('adresses possibles (21/10/2026)', () => {
  const zone = { latitude: 48.852, longitude: 2.3957, rayonM: 281 };
  const f = fiche({ codePostal: '75011', zone, surface: 42, consoKwhM2: 172, gesKgM2: 36, dpe: 'D', ges: 'D', etage: null });
  const candidat = (adresse: string, cp: string, point: string, over: LigneDpe = {}) =>
    dpe({
      numero_dpe: adresse,
      adresse_ban: adresse,
      code_postal_ban: cp,
      _geopoint: point,
      surface_habitable_logement: 42.2,
      conso_5_usages_par_m2_ep: 171.5,
      emission_ges_5_usages_par_m2: 36,
      etiquette_dpe: 'D',
      etiquette_ges: 'D',
      complement_adresse_logement: '',
      ...over,
    });

  it('deux immeubles à égalité : les deux, l’autre côté du boulevard compris', () => {
    const lignes = [
      candidat('58 Boulevard de Charonne 75020 Paris', '75020', '48.8525,2.3960'),
      candidat('44 Rue Chanzy 75011 Paris', '75011', '48.8530,2.3930'),
    ];
    assert.deepEqual(adressesPossibles(f, lignes).map((p) => p.adresse).sort(), ['44 Rue Chanzy 75011 Paris', '58 Boulevard de Charonne 75020 Paris']);
  });

  it('trois au plus, un seul par immeuble', () => {
    const lignes = [
      candidat('1 Rue A 75011 Paris', '75011', '48.8521,2.3955'),
      candidat('1 Rue A 75011 Paris', '75011', '48.8521,2.3955', { numero_dpe: 'bis' }),
      candidat('2 Rue B 75011 Paris', '75011', '48.8522,2.3956'),
      candidat('3 Rue C 75011 Paris', '75011', '48.8523,2.3957'),
      candidat('4 Rue D 75011 Paris', '75011', '48.8524,2.3958'),
    ];
    const possibles = adressesPossibles(f, lignes);
    assert.equal(possibles.length, 3);
    assert.equal(new Set(possibles.map((p) => p.adresse)).size, 3);
  });

  it('jamais une surface trop éloignée, ni un immeuble à plus de 400 m du repère', () => {
    const lignes = [
      candidat('55 Boulevard de Charonne 75011 Paris', '75011', '48.8525,2.3960', { surface_habitable_logement: 88 }),
      candidat('31 Avenue Parmentier 75011 Paris', '75011', '48.8650,2.3740'),
    ];
    assert.deepEqual(adressesPossibles(f, lignes), []);
  });

  it('localiserFiche les renvoie quand l’adresse reste à départager', async () => {
    const fetcher = async () => ({
      ok: true,
      json: async () => ({
        results: [
          candidat('58 Boulevard de Charonne 75020 Paris', '75020', '48.8525,2.3960'),
          // Comme le vrai 44 rue Chanzy : 360 m hors du quartier publié.
          candidat('44 Rue Chanzy 75011 Paris', '75011', '48.8530,2.3890'),
        ],
      }),
    });
    const loc = await localiserFiche(f, fetcher);
    assert.equal(loc.confiance, 'incertaine');
    assert.equal(loc.adressesPossibles?.length, 2);
  });
});

describe('rue publiée par le portail (PAP « Rue du Surmelin », 21/10/2026)', () => {
  const surmelin = fiche({
    portail: 'pap',
    codePostal: '75020',
    surface: 23,
    etage: 1,
    dpe: 'E',
    ges: 'C',
    consoKwhM2: null,
    gesKgM2: null,
    description: 'Métro Pelleport. Beau studio au 1er étage.',
    zone: { latitude: 48.868872, longitude: 2.404689, rayonM: 350 },
    voiePubliee: 'Rue du Surmelin',
  });

  it('fouille toute la rue (nom BAN), avec l’étiquette quand la conso manque', () => {
    const [avecSurface, sansSurface] = requetesDpe(surmelin);
    assert.equal(avecSurface!.params.nom_rue_ban_eq, 'Rue du Surmelin');
    assert.equal(avecSurface!.params.code_postal_ban_eq, '75020');
    assert.equal(avecSurface!.params.etiquette_dpe_eq, 'E');
    assert.equal(avecSurface!.params.surface_habitable_logement_gte, '20');
    assert.equal(sansSurface!.params.surface_habitable_logement_gte, undefined);
  });

  it('le DPE de la rue publiée devance ceux des rues voisines, adresse probable sans conso', () => {
    const rue = dpe({
      numero_dpe: 'S30',
      adresse_ban: '30 Rue du Surmelin 75020 Paris',
      nom_rue_ban: 'Rue du Surmelin',
      code_postal_ban: '75020',
      _geopoint: '48.8683,2.4040',
      surface_habitable_logement: 25.8,
      etiquette_dpe: 'E',
      etiquette_ges: 'C',
      complement_adresse_logement: 'Etage 1; Porte droite',
    });
    const voisine = dpe({
      numero_dpe: 'M8',
      adresse_ban: '8 Rue du Groupe Manouchian 75020 Paris',
      nom_rue_ban: 'Rue du Groupe Manouchian',
      code_postal_ban: '75020',
      _geopoint: '48.8689,2.4047',
      surface_habitable_logement: 24.3,
      etiquette_dpe: 'E',
      etiquette_ges: 'C',
      complement_adresse_logement: 'Etage 1; Porte Gauche',
    });
    const d = decider(surmelin, [voisine, rue], 'zone');
    assert.equal(d.meilleur!.dpe.numero_dpe, 'S30');
    assert.equal(d.statut, 'probable');
  });
});
