import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Zone } from '@/lib/zones/types';
import { aUnSecteur, adresseVerifiee, annoncesAProspecter, secteursAProspecter } from './liste-prospection';
import type { Annonce } from './types';

const zone: Zone = {
  id: 'z1',
  agencyId: 'ag',
  nom: 'Est',
  couleur: '#1A2A56',
  assignedTo: 'nego',
  joursSemaine: [],
  actif: true,
  verrouillee: false,
  regles: [{ id: 'r1', zoneId: 'z1', inclusion: true, type: 'code_postal', valeur: { code_postal: '75020' } }],
};

function annonce(over: Partial<Annonce> = {}): Annonce {
  return {
    id: 'a',
    idPortail: '1',
    portail: 'pap',
    url: 'https://www.pap.fr/annonces/appartement-paris-20e-r1',
    typeVendeur: 'particulier',
    agenceNom: null,
    refusDemarchage: false,
    statut: 'active',
    publieeLe: '2026-10-20T08:00:00Z',
    premiereVueLe: '2026-10-25T01:00:00Z',
    derniereVueLe: '2026-10-25T01:00:00Z',
    retireeLe: null,
    typeBien: 'appartement',
    titre: null,
    prixInitial: null,
    prix: 415000,
    surface: 37,
    pieces: 2,
    etage: null,
    dpe: 'C',
    codePostal: '75020',
    ville: 'Paris',
    quartier: null,
    confiance: 'certaine',
    localisationPrecision: 'logement',
    adresse: '91 Rue des Pyrénées 75020 Paris',
    adresseNumero: '91',
    adresseVoie: 'Rue des Pyrénées',
    parcelleIds: [],
    numeroDpe: null,
    complementDpe: null,
    latitude: 48.86,
    longitude: 2.39,
    logementCle: null,
    scoreLocalisation: null,
    raisonsLocalisation: [],
    photos: [],
    ...over,
  };
}

describe('annoncesAProspecter', () => {
  it('un logement sur PAP et SeLoger compte une fois, l’annonce qui porte l’adresse devant', () => {
    const g = annoncesAProspecter(
      [
        annonce({ id: 'seloger', portail: 'seloger', logementCle: 'L1', confiance: 'incertaine', adresse: null, derniereVueLe: '2026-10-25T02:00:00Z' }),
        annonce({ id: 'pap', logementCle: 'L1' }),
      ],
      [zone],
      'nego',
    );
    assert.equal(g.length, 1);
    assert.equal(g[0]?.principale.id, 'pap');
    assert.equal(g[0]?.annonces.length, 2);
  });

  it('secteur par secteur : chacun des miens, même vide, puis ceux de l’agence qui ont des annonces', () => {
    const second: Zone = {
      ...zone,
      id: 'z3',
      nom: 'Nord',
      regles: [{ id: 'r3', zoneId: 'z3', inclusion: true, type: 'code_postal', valeur: { code_postal: '75019' } }],
    };
    const collegue: Zone = {
      ...zone,
      id: 'z2',
      nom: 'Ouest',
      assignedTo: 'autre',
      regles: [{ id: 'r2', zoneId: 'z2', inclusion: true, type: 'code_postal', valeur: { code_postal: '75011' } }],
    };
    const videCollegue: Zone = { ...collegue, id: 'z4', nom: 'Sud', regles: [{ id: 'r4', zoneId: 'z4', inclusion: true, type: 'code_postal', valeur: { code_postal: '75013' } }] };
    const sansContour: Zone = { ...zone, id: 'z5', nom: 'À dessiner', regles: [] };
    const annonces = [
      annonce({ id: 'chez-moi' }),
      annonce({ id: 'collegue', codePostal: '75011' }),
      annonce({ id: 'hors', codePostal: '75012' }),
      annonce({ id: 'retiree', statut: 'retiree' }),
      annonce({ id: 'pro', typeVendeur: 'professionnel' }),
    ];
    const secteurs = secteursAProspecter(annonces, [zone, second, collegue, videCollegue, sansContour], 'nego');
    assert.deepEqual(
      secteurs.map((s) => [s.zone.id, s.mien, s.groupes.map((g) => g.cle)]),
      [
        ['z1', true, ['chez-moi']],
        ['z3', true, []],
        ['z2', false, ['collegue']],
      ],
    );
    assert.deepEqual(annoncesAProspecter(annonces, [zone, second, collegue], 'nego').map((g) => g.cle), ['chez-moi']);
  });

  it('un secteur sans contour ni rue ne compte pas comme mon secteur', () => {
    assert.equal(aUnSecteur([{ ...zone, regles: [] }], 'nego'), false);
    assert.equal(aUnSecteur([zone], 'nego'), true);
  });

  it('la rue seule n’est pas une adresse vérifiée', () => {
    assert.equal(adresseVerifiee(annonce()), true);
    assert.equal(adresseVerifiee(annonce({ confiance: 'incertaine', adresse: null })), false);
  });
});
