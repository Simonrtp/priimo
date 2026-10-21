import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Annonce } from '@/lib/annonces/types';
import { annoncesDeLaParcelle } from './parcelle-annonces';

const MAINTENANT = new Date('2026-10-19T12:00:00Z');

function annonce(over: Partial<Annonce> = {}): Annonce {
  return {
    id: 'a1',
    idPortail: 'x',
    portail: 'pap',
    url: 'https://www.pap.fr/annonces/appartement-paris-20e-75020-r1',
    typeVendeur: 'particulier',
    agenceNom: null,
    refusDemarchage: false,
    statut: 'active',
    publieeLe: '2026-09-01T10:00:00Z',
    premiereVueLe: '2026-10-16T20:00:00Z',
    derniereVueLe: '2026-10-18T20:00:00Z',
    retireeLe: null,
    typeBien: 'appartement',
    titre: null,
    prixInitial: 400_000,
    prix: 380_000,
    surface: 52.5,
    pieces: 2,
    etage: '3',
    dpe: 'E',
    codePostal: '75020',
    ville: 'Paris 20E',
    quartier: null,
    confiance: 'certaine',
    localisationPrecision: 'logement',
    adresse: '10 Rue des Pyrénées 75020 Paris',
    adresseNumero: '10',
    adresseVoie: 'Rue des Pyrénées',
    parcelleIds: ['75120000AB0012'],
    numeroDpe: 'DPE-1',
    complementDpe: null,
    latitude: 48.86,
    longitude: 2.4,
    logementCle: null,
    scoreLocalisation: 90,
    raisonsLocalisation: [],
    ...over,
  };
}

describe('annoncesDeLaParcelle', () => {
  it('résume une annonce : prix, baisse, vendeur, portail', () => {
    const [ligne] = annoncesDeLaParcelle([annonce()], MAINTENANT);
    assert.deepEqual(ligne, {
      id: 'a1',
      url: 'https://www.pap.fr/annonces/appartement-paris-20e-75020-r1',
      portail: 'PAP',
      portails: ['pap'],
      particulier: true,
      agence: null,
      prix: 380_000,
      baisse: 5,
      pieces: 2,
      surface: 52.5,
      etage: '3',
      dpe: 'E',
      retiree: false,
    });
  });

  it('un logement sur deux portails ne fait qu’une ligne, en vente avant tout', () => {
    const pap = annonce({ id: 'pap', logementCle: 'DPE-1' });
    const bienici = annonce({ id: 'bi', portail: 'bienici', logementCle: 'DPE-1', derniereVueLe: '2026-10-18T21:00:00Z' });
    const lignes = annoncesDeLaParcelle([pap, bienici], MAINTENANT);
    assert.equal(lignes.length, 1);
    assert.deepEqual([...(lignes[0]?.portails ?? [])].sort(), ['bienici', 'pap']);
  });

  it('les particuliers devant les agences, les retirées récentes derrière, les anciennes oubliées', () => {
    const agence = annonce({ id: 'ag', typeVendeur: 'professionnel', agenceNom: 'Agence du Village' });
    const particulier = annonce({ id: 'part', derniereVueLe: '2026-10-10T20:00:00Z' });
    const retireeRecente = annonce({ id: 'rr', statut: 'retiree', retireeLe: '2026-09-20T20:00:00Z' });
    const retireeAncienne = annonce({ id: 'ra', statut: 'retiree', retireeLe: '2026-05-01T20:00:00Z' });
    const lignes = annoncesDeLaParcelle([agence, retireeAncienne, retireeRecente, particulier], MAINTENANT);
    assert.deepEqual(
      lignes.map((l) => l.id),
      ['part', 'ag', 'rr'],
    );
    assert.equal(lignes[2]!.retiree, true);
    assert.equal(lignes[2]!.baisse, null);
  });
});
