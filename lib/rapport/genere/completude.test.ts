import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { completudePage } from './completude';
import type { DossierRapport } from './types';

function dossier(over: Partial<DossierRapport> = {}): DossierRapport {
  return {
    titreCouverture: 'Avis de valeur',
    ctaProchaineEtape: 'Suite',
    dateEvaluation: '2026-09-01',
    adresse: '12 rue X 75011 Paris',
    city: 'Paris',
    postalCode: '75011',
    propertyType: 'appartement',
    surfaceM2: 50,
    surfaceCarrez: null,
    rooms: 2,
    floor: '3',
    occupation: 'libre',
    dpeClass: 'D',
    gesClass: null,
    etatLibelle: null,
    balconTerrasse: null,
    commentairesPublics: 'Bel appartement.',
    remarquesExpert: null,
    etagesImmeuble: 6,
    anneeConstruction: null,
    ascenseur: true,
    chambres: 1,
    annexes: [],
    photos: [],
    photoCouverture: null,
    latitude: 48.86,
    longitude: 2.38,
    priceValue: 300000,
    priceLow: 280000,
    priceHigh: 320000,
    pricePerM2: 6000,
    surfacePrixLibelle: 'habitable',
    fourchetteAjoutee: false,
    client: { prenom: 'Marie', nom: 'Marie Durand', telephone: null, email: 'a@b.fr' },
    agence: {
      nom: 'SARL',
      nomCommercial: 'Agence',
      adresse: null,
      telephone: null,
      email: null,
      siteWeb: null,
      logoUrl: null,
      couleurPrincipale: '#1A6B4A',
    },
    agent: { nom: 'Paul', email: null, telephone: null, photoUrl: null },
    comparables: [],
    comparablesReserve: [],
    annonces: [],
    annoncesReserve: [],
    iris: null,
    equipements: [],
    fixe: [],
    mobile: [],
    permis: [],
    oat: [],
    effort: null,
    fluiditeJoursMedian: null,
    negotiationPctMedian: null,
    contradictions: [],
    ...over,
  };
}

describe('complétude des pages générées', () => {
  it('affiche le secteur même sans IRIS', () => {
    const c = completudePage('secteur', dossier());
    assert.deepEqual(c.manques, []);
  });

  it('accepte la couverture typographique sans photo', () => {
    const c = completudePage('couverture', dossier({ photos: [], photoCouverture: null }));
    assert.deepEqual(c.manques, []);
  });

  it('exige une valeur pour Notre estimation', () => {
    const c = completudePage('prix', dossier({ priceValue: null }));
    assert.ok(c.manques.includes('Valeur estimée'));
  });

  it('n’affiche pas les biens en vente sans nuage ni tableau', () => {
    const c = completudePage('concurrentiel', dossier({ annonces: [] }));
    assert.ok(c.manques.includes('Annonces insuffisantes'));
  });
});
