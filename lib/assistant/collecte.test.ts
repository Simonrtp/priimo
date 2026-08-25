import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  collectFromSnapshot,
  scopeByAgency,
  type AgencySnapshot,
  type CollecteBien,
  type CollecteContact,
  type CollecteLead,
} from './collecte';
import type { AssistantIntent } from './intent';
import type { SearchCriteria } from '@/types/contact';
import type { RecordViewer } from '@/lib/agency/visibility';

const AGENCY_A = 'agence-a';
const AGENCY_B = 'agence-b';
const BAN = '75120_0123_00027';

const director: RecordViewer = { id: 'dir-1', role: 'directeur' };
const collab: RecordViewer = { id: 'col-1', role: 'collaborateur' };

const emptyCriteria: SearchCriteria = {
  budgetMin: null,
  budgetMax: null,
  surfaceMin: null,
  surfaceMax: null,
  roomsMin: null,
  postalCodes: [],
};

function intentImmeuble(adresse = '27 rue Alphonse Penaud'): AssistantIntent {
  return {
    type: 'immeuble',
    adresse,
    code_postal: null,
    nom: null,
    periode_jours: null,
    filtres: { type_contact: null, statut_mandat: null },
  };
}

function lead(over: Partial<CollecteLead> = {}): CollecteLead {
  return {
    id: 'lead-1',
    agencyId: AGENCY_A,
    banId: BAN,
    address: '27 rue Alphonse Penaud',
    adresseNormalisee: '27 Rue Alphonse Penaud 75020 Paris',
    postalCode: '75020',
    city: 'Paris',
    score: 72,
    signalLabels: ['DPE F'],
    marcheStatut: 'en_vente',
    deliveredAt: '2026-03-12',
    createdAt: '2026-03-12T10:00:00.000Z',
    assignedTo: 'dir-1',
    ...over,
  };
}

function contact(over: Partial<CollecteContact> = {}): CollecteContact {
  return {
    id: 'ct-1',
    agencyId: AGENCY_A,
    banId: BAN,
    address: '27 rue Alphonse Penaud',
    fullName: 'Marie Martin',
    firstName: 'Marie',
    lastName: 'Martin',
    type: 'vendeur',
    phone: '0600000000',
    source: 'manuel',
    createdAt: '2026-04-01T10:00:00.000Z',
    assignedTo: 'dir-1',
    createdBy: 'dir-1',
    leadId: null,
    criteria: emptyCriteria,
    ...over,
  };
}

function bien(over: Partial<CollecteBien> = {}): CollecteBien {
  return {
    id: 'bien-1',
    agencyId: AGENCY_A,
    banId: '75120_vitruve_00005',
    address: '5 Rue Vitruve',
    city: 'Paris',
    postalCode: '75020',
    price: 856152,
    surfaceM2: 88,
    rooms: 2,
    mandatStatut: 'mandat_simple',
    createdAt: '2026-04-01T10:00:00.000Z',
    updatedAt: '2026-04-01T10:00:00.000Z',
    createdBy: 'dir-1',
    proprietaireContactId: 'ct-owner',
    ...over,
  };
}

const emptySnap: AgencySnapshot = {
  leads: [],
  contacts: [],
  interactions: [],
  biens: [],
  notes: [],
};

describe('collecte — vide et isolation', () => {
  it('un ban_id sans aucune donnée renvoie un résultat vide, pas une erreur', () => {
    const result = collectFromSnapshot(intentImmeuble(), emptySnap, {
      agencyId: AGENCY_A,
      viewer: director,
      banId: BAN,
      rechercheParTexte: false,
    });
    assert.equal(result.lignes.length, 0);
    assert.equal(result.sources.length, 0);
    assert.equal(result.banId, BAN);
  });

  it('écarte une ligne dont l’agency_id n’est pas celui de session', () => {
    const forged = lead({ id: 'lead-b', agencyId: AGENCY_B, assignedTo: null });
    const scoped = scopeByAgency([forged, lead()], AGENCY_A);
    assert.equal(scoped.length, 1);
    assert.equal(scoped[0]?.id, 'lead-1');

    const result = collectFromSnapshot(
      intentImmeuble(),
      { ...emptySnap, leads: [forged, lead()] },
      { agencyId: AGENCY_A, viewer: director, banId: BAN },
    );
    assert.equal(result.lignes.length, 1);
    assert.equal(result.lignes[0]?.id, 'lead-1');
    assert.ok(result.lignes.every((l) => l.id !== 'lead-b'));
  });
});

describe('collecte — visibilité own', () => {
  it('un collaborateur ne récupère pas la fiche d’un collègue', () => {
    const colleague = contact({
      id: 'ct-collegue',
      assignedTo: 'dir-1',
      createdBy: 'dir-1',
    });
    const mine = contact({
      id: 'ct-mien',
      assignedTo: 'col-1',
      createdBy: 'col-1',
      fullName: 'Paul Durand',
      firstName: 'Paul',
      lastName: 'Durand',
    });

    const asCollab = collectFromSnapshot(
      intentImmeuble(),
      { ...emptySnap, contacts: [colleague, mine] },
      { agencyId: AGENCY_A, viewer: collab, banId: BAN },
    );
    assert.deepEqual(
      asCollab.lignes.filter((l) => l.kind === 'contact').map((l) => l.id),
      ['ct-mien'],
    );

    const asDir = collectFromSnapshot(
      intentImmeuble(),
      { ...emptySnap, contacts: [colleague, mine] },
      { agencyId: AGENCY_A, viewer: director, banId: BAN },
    );
    assert.equal(asDir.lignes.filter((l) => l.kind === 'contact').length, 2);
  });
});

describe('collecte — activité', () => {
  it('ne reprend pas une dictée sur des fiches déjà supprimées', () => {
    const now = new Date('2026-08-21T10:00:00.000Z');
    const result = collectFromSnapshot(
      {
        type: 'activite',
        adresse: null,
        code_postal: null,
        nom: null,
        periode_jours: 1,
        filtres: { type_contact: null, statut_mandat: null },
      },
      {
        ...emptySnap,
        contacts: [
          contact({
            id: 'ct-restant',
            fullName: 'Fils de Martine Durand',
            firstName: 'Fils',
            lastName: 'Durand',
            createdAt: '2026-01-01T10:00:00.000Z',
          }),
        ],
        notes: [
          {
            id: 'note-orpheline',
            agencyId: AGENCY_A,
            banId: null,
            adresseNormalisee: null,
            createdAt: '2026-08-21T09:00:00.000Z',
            createdBy: 'dir-1',
            assignedTo: 'dir-1',
            transcript:
              'Rappeler Malissa Terrier demain pour 2,5 millions. Adrien Planchenot-Lagarde cherche dans le 20e.',
            contactId: null,
          },
        ],
      },
      { agencyId: AGENCY_A, viewer: director, now },
    );

    const blob = JSON.stringify(result.lignes);
    assert.equal(result.lignes.some((l) => l.kind === 'note'), false);
    assert.doesNotMatch(blob, /Malissa Terrier/);
    assert.doesNotMatch(blob, /Adrien Planchenot-Lagarde/);
    assert.equal(result.lignes.filter((l) => l.kind === 'contact').map((l) => l.id).join(), 'ct-restant');
  });
});

describe('collecte — rue sans numéro', () => {
  it('trouve le bien même si le BAN géocodé n’est pas celui de l’immeuble', () => {
    const owner = contact({
      id: 'ct-owner',
      fullName: 'Hélène Nguyen',
      firstName: 'Hélène',
      lastName: 'Nguyen',
      address: null,
      banId: null,
    });
    const result = collectFromSnapshot(intentImmeuble('rue Vitruve'), {
      ...emptySnap,
      biens: [bien()],
      contacts: [owner],
    }, {
      agencyId: AGENCY_A,
      viewer: director,
      banId: '75120_street_vitruve',
      rechercheParTexte: false,
    });

    assert.equal(result.lignes.some((l) => l.kind === 'bien' && l.id === 'bien-1'), true);
    assert.equal(result.lignes.some((l) => l.kind === 'contact' && l.id === 'ct-owner'), true);
    assert.match(JSON.stringify(result.lignes), /Hélène Nguyen/);
  });
});

