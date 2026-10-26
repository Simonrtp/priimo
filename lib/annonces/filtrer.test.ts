import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DEFAULT_MAP_LAYERS, type MapLayerState } from '@/lib/carte/layers';
import type { Zone } from '@/lib/zones/types';
import { bilanAnnonces, filtrerAnnonces, mesAnnoncesSurCarte } from './filtrer';
import type { Annonce } from './types';

const MAINTENANT = new Date('2026-10-18T12:00:00Z');
const QUI = { directeur: false, profileId: 'nego' };

function annonce(over: Partial<Annonce> = {}): Annonce {
  return {
    id: 'a1',
    idPortail: 'x',
    portail: 'pap',
    url: 'https://example.test/a1',
    typeVendeur: 'particulier',
    agenceNom: null,
    refusDemarchage: false,
    statut: 'active',
    publieeLe: '2026-09-01T10:00:00Z',
    premiereVueLe: '2026-10-16T20:00:00Z',
    derniereVueLe: '2026-10-17T20:00:00Z',
    retireeLe: null,
    typeBien: 'appartement',
    titre: null,
    prixInitial: 400_000,
    prix: 400_000,
    surface: 50,
    pieces: 2,
    etage: '3',
    dpe: 'E',
    codePostal: '75020',
    ville: 'Paris',
    quartier: null,
    confiance: 'probable',
    localisationPrecision: 'logement',
    adresse: '10 Rue des Pyrénées 75020 Paris',
    adresseNumero: '10',
    adresseVoie: 'Rue des Pyrénées',
    parcelleIds: [],
    numeroDpe: null,
    complementDpe: null,
    latitude: 48.86,
    longitude: 2.4,
    logementCle: null,
    scoreLocalisation: 80,
    raisonsLocalisation: [],
    ...over,
  };
}

function reglages(over: Partial<MapLayerState> = {}): MapLayerState {
  return { ...DEFAULT_MAP_LAYERS, annonces: true, ...over };
}

const secteurPyrenees: Zone = {
  id: 'z1',
  agencyId: 'ag',
  nom: 'Pyrénées',
  couleur: '#1A2A56',
  assignedTo: 'nego',
  joursSemaine: [],
  actif: true,
  verrouillee: false,
  regles: [
    {
      id: 'r1',
      zoneId: 'z1',
      inclusion: true,
      type: 'voie',
      valeur: { nom_voie: 'Rue des Pyrénées', code_postal: '75020', parite: 'toutes', numero_min: null, numero_max: null },
    },
  ],
};

const ids = (liste: Annonce[]) => liste.map((a) => a.id);

describe('filtrerAnnonces', () => {
  const particulier = annonce({ id: 'part' });
  const agence = annonce({ id: 'pro', typeVendeur: 'professionnel', agenceNom: 'Agence du Village' });

  it('garde tous les vendeurs et tous les statuts', () => {
    const nouvelle = annonce({ id: 'neuve', publieeLe: '2026-10-15T08:00:00Z' });
    const baisse = annonce({ id: 'baisse', prix: 380_000 });
    const retiree = annonce({ id: 'partie', statut: 'retiree', retireeLe: '2026-10-10T20:00:00Z' });
    const liste = [particulier, agence, nouvelle, baisse, retiree];
    assert.deepEqual(
      ids(filtrerAnnonces(liste, reglages({ annoncesVendeur: 'particulier', annoncesStatut: 'baisse' }), [], QUI, MAINTENANT)),
      ['part', 'pro', 'neuve', 'baisse', 'partie'],
    );
  });

  it('le bouton Secteur ne garde que les annonces de ce secteur', () => {
    const ailleurs = annonce({
      id: 'loin',
      adresseVoie: 'Rue de Bagnolet',
      adresse: '4 Rue de Bagnolet 75020 Paris',
    });
    assert.deepEqual(
      ids(
        filtrerAnnonces(
          [particulier, ailleurs],
          reglages({ annoncesMonSecteur: false }),
          [secteurPyrenees],
          { ...QUI, zoneCadree: secteurPyrenees },
          MAINTENANT,
        ),
      ),
      ['part'],
    );
  });

  it('tous les secteurs du directeur gardent chaque périmètre', () => {
    const bagnolet: Zone = {
      ...secteurPyrenees,
      id: 'z2',
      nom: 'Bagnolet',
      assignedTo: 'camille',
      regles: [
        {
          id: 'r2',
          zoneId: 'z2',
          inclusion: true,
          type: 'voie',
          valeur: {
            nom_voie: 'Rue de Bagnolet',
            code_postal: '75020',
            parite: 'toutes',
            numero_min: null,
            numero_max: null,
          },
        },
      ],
    };
    const loin = annonce({
      id: 'loin',
      adresseVoie: 'Rue de Bagnolet',
      adresse: '4 Rue de Bagnolet 75020 Paris',
    });
    const hors = annonce({
      id: 'hors',
      adresseVoie: 'Rue de Charonne',
      adresse: '2 Rue de Charonne 75011 Paris',
    });
    assert.deepEqual(
      ids(
        filtrerAnnonces(
          [particulier, loin, hors],
          reglages(),
          [secteurPyrenees, bagnolet],
          { directeur: true, profileId: 'dir', zonesCadrees: [secteurPyrenees, bagnolet] },
          MAINTENANT,
        ),
      ),
      ['part', 'loin'],
    );
  });
});

describe('bilanAnnonces', () => {
  it('compte la carte, mon secteur et les annonces sans position', () => {
    const dansSecteur = annonce({ id: 'pyr' });
    const ailleurs = annonce({ id: 'loin', adresseVoie: 'Rue de Bagnolet', adresse: null });
    const sansPosition = annonce({ id: 'flou', latitude: null, longitude: null, adresseVoie: null });
    const liste = [dansSecteur, ailleurs, sansPosition];

    const tous = bilanAnnonces(liste, reglages(), [secteurPyrenees], QUI, MAINTENANT);
    assert.deepEqual(tous, { surCarte: 2, sansPosition: 1, tousSecteurs: 2, dansMonSecteur: 1 });

    const secteur = bilanAnnonces(liste, reglages(), [secteurPyrenees], { ...QUI, zoneCadree: secteurPyrenees }, MAINTENANT);
    assert.equal(secteur.surCarte, 1);
    assert.equal(secteur.sansPosition, 0);
  });

  it('compte un logement vu sur deux portails une seule fois', () => {
    const pap = annonce({ id: 'pap', logementCle: 'DPE-1' });
    const bienici = annonce({ id: 'bi', portail: 'bienici', logementCle: 'DPE-1' });
    assert.equal(bilanAnnonces([pap, bienici], reglages(), [], QUI, MAINTENANT).surCarte, 1);
  });
});

describe('mesAnnoncesSurCarte', () => {
  const collegue: Zone = { ...secteurPyrenees, id: 'z2', nom: 'Bagnolet', assignedTo: 'collegue', regles: [{ id: 'r2', zoneId: 'z2', inclusion: true, type: 'voie', valeur: { nom_voie: 'Rue de Bagnolet', code_postal: '75020', parite: 'toutes', numero_min: null, numero_max: null } }] };
  const annonces = [
    annonce({ id: 'mienne' }),
    annonce({ id: 'pro', typeVendeur: 'professionnel' }),
    annonce({ id: 'retiree', statut: 'retiree' }),
    annonce({ id: 'collegue', adresse: '5 Rue de Bagnolet 75020 Paris', adresseNumero: '5', adresseVoie: 'Rue de Bagnolet' }),
    annonce({ id: 'hors-secteur', adresse: '3 Rue Oberkampf 75011 Paris', adresseNumero: '3', adresseVoie: 'Rue Oberkampf', codePostal: '75011' }),
  ];

  it('l’agent voit les annonces de particuliers actives de son secteur, rien d’autre', () => {
    assert.deepEqual(ids(mesAnnoncesSurCarte(annonces, [secteurPyrenees, collegue], QUI)), ['mienne']);
  });

  it('le directeur voit celles de tous les secteurs, ou du seul secteur cadré', () => {
    const directeur = { directeur: true, profileId: 'dir' };
    assert.deepEqual(ids(mesAnnoncesSurCarte(annonces, [secteurPyrenees, collegue], directeur)), ['mienne', 'collegue']);
    assert.deepEqual(
      ids(mesAnnoncesSurCarte(annonces, [secteurPyrenees, collegue], { ...directeur, zoneCadree: collegue })),
      ['collegue'],
    );
  });

  it('sur le code postal : toutes les annonces de particuliers actives', () => {
    assert.deepEqual(
      ids(mesAnnoncesSurCarte(annonces, [secteurPyrenees, collegue], { ...QUI, toutLeCodePostal: true })),
      ['mienne', 'collegue', 'hors-secteur'],
    );
  });
});
