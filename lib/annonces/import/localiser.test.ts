import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
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

  it('un seul DPE faible dans une rue ne fait pas « la rue »', async () => {
    const fetcher = async () => ({ ok: true, json: async () => ({ results: [dpe({ adresse_ban: '17 Rue de Lappe 75011 Paris', _geopoint: '48.8530,2.3720' })] }) });
    const loc = await localiserFiche(
      fiche({ consoKwhM2: null, gesKgM2: null, etage: null, description: null, zone: { latitude: 48.853, longitude: 2.372, rayonM: 400 } }),
      fetcher,
    );
    assert.equal(loc.adresse, null);
  });
});
