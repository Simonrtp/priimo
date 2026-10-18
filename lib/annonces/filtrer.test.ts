import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DEFAULT_MAP_LAYERS, type MapLayerState } from '@/lib/carte/layers';
import type { Zone } from '@/lib/zones/types';
import { bilanAnnonces, filtrerAnnonces } from './filtrer';
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
  const tout = [particulier, agence];

  it('choisit le vendeur', () => {
    assert.deepEqual(ids(filtrerAnnonces(tout, reglages(), [], QUI, MAINTENANT)), ['part']);
    assert.deepEqual(
      ids(filtrerAnnonces(tout, reglages({ annoncesVendeur: 'professionnel' }), [], QUI, MAINTENANT)),
      ['pro'],
    );
    assert.deepEqual(ids(filtrerAnnonces(tout, reglages({ annoncesVendeur: 'tous' }), [], QUI, MAINTENANT)), [
      'part',
      'pro',
    ]);
  });

  it('distingue en vente, nouvelles, baisses et retirées', () => {
    const nouvelle = annonce({ id: 'neuve', publieeLe: '2026-10-15T08:00:00Z' });
    const baisse = annonce({ id: 'baisse', prix: 380_000 });
    const retiree = annonce({ id: 'partie', statut: 'retiree', retireeLe: '2026-10-10T20:00:00Z' });
    const liste = [particulier, nouvelle, baisse, retiree];
    const pour = (annoncesStatut: MapLayerState['annoncesStatut']) =>
      ids(filtrerAnnonces(liste, reglages({ annoncesStatut }), [], QUI, MAINTENANT));
    assert.deepEqual(pour('actives'), ['part', 'neuve', 'baisse']);
    assert.deepEqual(pour('nouvelles'), ['neuve']);
    assert.deepEqual(pour('baisse'), ['baisse']);
    assert.deepEqual(pour('retirees'), ['partie']);
  });

  it('retient plusieurs classes DPE et « 5 pièces et plus »', () => {
    const f = annonce({ id: 'f', dpe: 'F', pieces: 6 });
    const g = annonce({ id: 'g', dpe: 'G', pieces: 5 });
    const liste = [particulier, f, g];
    assert.deepEqual(ids(filtrerAnnonces(liste, reglages({ annoncesDpe: 'FG' }), [], QUI, MAINTENANT)), ['f', 'g']);
    assert.deepEqual(ids(filtrerAnnonces(liste, reglages({ annoncesPieces: '5' }), [], QUI, MAINTENANT)), ['f', 'g']);
    assert.deepEqual(ids(filtrerAnnonces(liste, reglages({ annoncesPieces: '2' }), [], QUI, MAINTENANT)), ['part']);
  });

  it('plafonne le prix', () => {
    const chere = annonce({ id: 'chere', prix: 900_000, prixInitial: 900_000 });
    assert.deepEqual(
      ids(filtrerAnnonces([particulier, chere], reglages({ annoncesPrixMax: '500000' }), [], QUI, MAINTENANT)),
      ['part'],
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
});

describe('bilanAnnonces', () => {
  it('compte la carte, mon secteur et les annonces sans position', () => {
    const dansSecteur = annonce({ id: 'pyr' });
    const ailleurs = annonce({ id: 'loin', adresseVoie: 'Rue de Bagnolet', adresse: null });
    const sansPosition = annonce({ id: 'flou', latitude: null, longitude: null, adresseVoie: null });
    const liste = [dansSecteur, ailleurs, sansPosition];

    const tous = bilanAnnonces(liste, reglages(), [secteurPyrenees], QUI, MAINTENANT);
    assert.deepEqual(tous, { surCarte: 2, sansPosition: 1, tousSecteurs: 2, dansMonSecteur: 1 });

    const secteur = bilanAnnonces(liste, reglages({ annoncesMonSecteur: true }), [secteurPyrenees], QUI, MAINTENANT);
    assert.equal(secteur.surCarte, 1);
    assert.equal(secteur.sansPosition, 0);
  });

  it('compte un logement vu sur deux portails une seule fois', () => {
    const pap = annonce({ id: 'pap', logementCle: 'DPE-1' });
    const bienici = annonce({ id: 'bi', portail: 'bienici', logementCle: 'DPE-1' });
    assert.equal(bilanAnnonces([pap, bienici], reglages(), [], QUI, MAINTENANT).surCarte, 1);
  });
});
