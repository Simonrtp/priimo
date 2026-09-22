import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { DossierRapport } from '@/lib/rapport/genere/types';
import { htmlPagesGenerees } from './document';

function dossier(over: Partial<DossierRapport> = {}): DossierRapport {
  return {
    titreCouverture: 'Avis de valeur',
    ctaProchaineEtape: 'Contactez-nous pour convenir d’une visite.',
    dateEvaluation: '2026-09-12',
    adresse: '12 rue X 75011 Paris',
    city: 'Paris',
    postalCode: '75011',
    propertyType: 'appartement',
    surfaceM2: 76,
    surfaceCarrez: 74,
    rooms: 3,
    floor: '3',
    occupation: 'libre',
    dpeClass: 'D',
    commentairesPublics: 'Bel appartement.',
    remarquesExpert: 'Travaux de peinture à prévoir.',
    etagesImmeuble: 6,
    anneeConstruction: 1972,
    ascenseur: true,
    chambres: 2,
    annexes: [{ libelle: 'Cave', surfaceM2: 6 }],
    photos: [],
    photoCouverture: null,
    latitude: 48.86,
    longitude: 2.38,
    priceValue: 546000,
    priceLow: 500000,
    priceHigh: 590000,
    pricePerM2: 7579,
    surfacePrixLibelle: 'Carrez',
    fourchetteAjoutee: false,
    client: { nom: 'marie DURAND', telephone: '0612345678', email: 'a@b.fr' },
    agence: {
      nom: 'SARL',
      nomCommercial: 'Agence Lumière',
      adresse: '1 rue Test',
      telephone: '0612345678',
      email: 'a@b.fr',
      siteWeb: null,
      logoUrl: null,
      couleurPrincipale: '#E8743C',
    },
    agent: { nom: 'paul martin', email: 'a@b.fr', telephone: '0612345678', photoUrl: null },
    comparables: [
      {
        id: 'c1',
        typeLocal: 'appartement',
        surfaceM2: 70,
        pieces: 3,
        prix: 520000,
        prixM2: 7428,
        date: '2026-03-01',
        distanceM: 120,
        codePostal: '75011',
        perimetre: 'rayon',
        horizonMois: 24,
      },
      {
        id: 'c2',
        typeLocal: 'appartement',
        surfaceM2: 80,
        pieces: 3,
        prix: 580000,
        prixM2: 7250,
        date: '2026-06-15',
        distanceM: 200,
        codePostal: '75011',
        perimetre: 'rayon',
        horizonMois: 24,
      },
    ],
    comparablesReserve: [],
    annonces: [],
    annoncesReserve: [],
    iris: {
      irisCode: '1',
      commune: 'Paris',
      partAppartements: 82,
      piecesDominant: 2,
      epoque: '1946-1970',
      partProprietaires: 40,
      partLocataires: 60,
    },
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

describe('document HTML avis de valeur', () => {
  it('rend les pages clés avec le formatage français', () => {
    const html = htmlPagesGenerees(
      ['couverture', 'votre_bien', 'immeuble_appartement', 'comparables', 'prix', 'prochaine_etape'],
      dossier(),
      '#E8743C',
    );
    assert.match(html, /Avis de valeur/);
    assert.match(html, /Prochaine étape/);
    assert.match(html, /546\u202f000\u00a0€/);
    assert.match(html, /76\u00a0m²/);
    assert.match(html, /€\/m²/);
    assert.match(html, /Marie Durand/);
    assert.match(html, /size:\s*A4 landscape/);
    assert.doesNotMatch(html, /546000/);
    assert.doesNotMatch(html, /[\u{1F300}-\u{1FAFF}]/u);
  });
});
