import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Zone } from '@/lib/zones/types';
import { nouvellesAdressesDuSecteur } from './nouvelles-adresses';
import type { Annonce } from './types';

function zone(over: Partial<Zone> = {}): Zone {
  return {
    id: 'z1',
    agencyId: 'ag',
    nom: 'Est',
    couleur: '#1A2A56',
    assignedTo: 'nego',
    joursSemaine: [],
    actif: true,
    verrouillee: false,
    regles: [{ id: 'r1', zoneId: 'z1', inclusion: true, type: 'code_postal', valeur: { code_postal: '75020' } }],
    ...over,
  };
}

function annonce(over: Partial<Annonce> = {}): Annonce {
  return {
    id: 'a',
    idPortail: '465801644',
    portail: 'pap',
    url: 'https://www.pap.fr/annonces/appartement-paris-20e-r465801644',
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
    prixInitial: 420000,
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
    photos: ['https://cdn.pap.fr/photos/1.webp'],
    ...over,
  };
}

describe('nouvellesAdressesDuSecteur', () => {
  it('les annonces de mon secteur, la plus récente d’abord, et elles ouvrent l’annonce', () => {
    const r = nouvellesAdressesDuSecteur(
      [annonce({ id: 'ancienne', publieeLe: '2026-10-01T08:00:00Z' }), annonce({ id: 'recente', publieeLe: '2026-10-24T08:00:00Z' })],
      [zone()],
      'nego',
    );
    assert.equal(r.total, 2);
    assert.equal(r.sansSecteur, false);
    assert.deepEqual(r.adresses.map((a) => a.id), ['recente', 'ancienne']);
    assert.deepEqual(r.adresses[0], {
      id: 'recente',
      address: '91 Rue des Pyrénées 75020 Paris',
      // Séparateur des milliers : espace insécable fine, comme l'affiche le formateur fr-FR.
      city: `PAP · ${new Intl.NumberFormat('fr-FR').format(415000)} € · 37 m²`,
      score: 0,
      mainSignalLabel: null,
      ownerName: null,
      signaux: ['Prix en baisse', '2 pièces', 'DPE C'],
      href: '/dashboard/prospection?vue=liste&annonce=recente',
      photo: 'https://cdn.pap.fr/photos/1.webp',
    });
  });

  it('le secteur d’un collègue, une annonce retirée ou d’agence ne comptent pas', () => {
    const r = nouvellesAdressesDuSecteur(
      [annonce({ id: 'retiree', statut: 'retiree' }), annonce({ id: 'pro', typeVendeur: 'professionnel' }), annonce({ id: 'ailleurs', codePostal: '75011' })],
      [zone(), zone({ id: 'z2', assignedTo: 'collegue', regles: [{ id: 'r2', zoneId: 'z2', inclusion: true, type: 'code_postal', valeur: { code_postal: '75011' } }] })],
      'nego',
    );
    assert.equal(r.total, 0);
  });

  it('sans adresse affirmée : la rue seule, signalée à confirmer', () => {
    const [a] = nouvellesAdressesDuSecteur(
      [annonce({ confiance: 'incertaine', adresse: null, adresseNumero: null, refusDemarchage: true, prixInitial: null })],
      [zone()],
      'nego',
    ).adresses;
    assert.equal(a?.address, 'Rue des Pyrénées 75020');
    assert.deepEqual(a?.signaux, ['Adresse à confirmer', '2 pièces', 'DPE C', 'Refuse les appels']);
  });

  it('sans secteur à moi : la carte invite à le poser', () => {
    assert.equal(nouvellesAdressesDuSecteur([annonce()], [zone({ assignedTo: 'collegue' })], 'nego').sansSecteur, true);
  });
});
