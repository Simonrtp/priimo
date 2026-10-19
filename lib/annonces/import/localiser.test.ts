import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { chercherCandidats, decider, etageDpe, requetesDpe, rueCitee, scorerCandidat, type LigneDpe } from './localiser';
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
    assert.deepEqual(requetesDpe(fiche({ consoKwhM2: null, zone: { latitude: 48.85, longitude: 2.4, rayonM: 800 } })), []);
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
