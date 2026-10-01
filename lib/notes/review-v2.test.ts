import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  actionsProposees,
  emailPropose,
  mailtoBrouillon,
  misesAJourProposees,
  prospectPropose,
  rechercheProposee,
  trouverPersonne,
  type BienContexte,
  type PersonneRef,
} from './review-v2';
import { EMPTY_NOTE_EXTRACTION, type NoteExtraction } from './propositions';

const janine: PersonneRef = {
  id: 'p0',
  personne: { firstName: 'Janine', lastName: 'Martin', phone: null, email: null, type: 'vendeur' },
  matches: [{ contactId: 'c1', label: 'Janine Martin', email: 'janine@exemple.fr' }],
};
const leroy: PersonneRef = {
  id: 'p1',
  personne: { firstName: 'Paul', lastName: 'Leroy', phone: null, email: null, type: 'acquereur' },
  matches: [],
};

const BIENS: BienContexte[] = [
  {
    id: 'b1',
    address: '12 rue des Lilas',
    city: 'Nantes',
    postalCode: '44000',
    price: 480000,
    surfaceM2: 72,
    rooms: 3,
    mandatStatut: 'mandat_simple',
    banId: 'ban-lilas',
  },
  {
    id: 'b2',
    address: '4 place Royale',
    city: 'Nantes',
    postalCode: '44000',
    price: 250000,
    surfaceM2: 40,
    rooms: 2,
    mandatStatut: 'mandat_exclusif',
    banId: null,
  },
];

function ex(partiel: Partial<NoteExtraction>): NoteExtraction {
  return { ...EMPTY_NOTE_EXTRACTION, ...partiel };
}

describe('trouverPersonne', () => {
  it('relie « Rappeler Mme Martin » à Janine Martin', () => {
    assert.equal(trouverPersonne('Rappeler Mme Martin', [janine, leroy]), 'p0');
  });
  it('ne relie rien sur un rôle ou un mot vide', () => {
    assert.equal(trouverPersonne('Rappeler le gardien', [janine, leroy]), null);
    assert.equal(trouverPersonne(null, [janine]), null);
  });
});

describe('actionsProposees', () => {
  const noteDate = new Date('2026-09-30T10:00:00Z');
  it('met demain, à confirmer, sur un rappel sans date', () => {
    const [a] = actionsProposees(
      ex({ actions: [{ type: 'rappel', intitule: 'Rappeler Paul Leroy', date: null, heure: null, personne: 'Paul Leroy', lieu: null, rdvType: null, interet: null }] }),
      [janine, leroy],
      noteDate,
    );
    assert.equal(a?.date, '2026-10-01');
    assert.equal(a?.dateDeduite, true);
    assert.equal(a?.personneRef, 'p1');
  });
  it('reprend l’ancienne promesse d’une note analysée avant les actions', () => {
    const actions = actionsProposees(
      ex({ actions: [], promesse: { intitule: 'Rappeler Janine', echeance: '2026-10-02' } }),
      [janine],
      noteDate,
    );
    assert.equal(actions[0]?.intitule, 'Rappeler Janine');
    assert.equal(actions[0]?.personneRef, 'p0');
  });
});

describe('misesAJourProposees', () => {
  it('trouve le bien cité et garde l’ancien prix pour le comparer', () => {
    const [m] = misesAJourProposees(
      ex({ misesAJour: [{ champ: 'prix', valeur: 450000, bien: '12 rue des Lilas' }] }),
      'Le vendeur du 12 rue des Lilas baisse à 450',
      BIENS,
      null,
    );
    assert.equal(m?.bienId, 'b1');
    assert.equal(m?.champ === 'prix' && m.avant, 480000);
  });
  it('se replie sur l’immeuble de la note', () => {
    const [m] = misesAJourProposees(
      ex({ misesAJour: [{ champ: 'statut_mandat', valeur: 'mandat_exclusif', bien: null }] }),
      'Mandat exclusif signé ce matin',
      BIENS,
      'ban-lilas',
    );
    assert.equal(m?.bienId, 'b1');
  });
  it('ne propose rien quand le bien est introuvable ou inchangé', () => {
    assert.deepEqual(
      misesAJourProposees(ex({ misesAJour: [{ champ: 'prix', valeur: 300000, bien: 'rue inconnue' }] }), '', BIENS, null),
      [],
    );
    assert.deepEqual(
      misesAJourProposees(ex({ misesAJour: [{ champ: 'prix', valeur: 480000, bien: '12 rue des Lilas' }] }), '', BIENS, null),
      [],
    );
  });
});

describe('rechercheProposee', () => {
  it('rattache la recherche à l’acquéreur et trouve les biens qui correspondent', () => {
    const r = rechercheProposee(
      ex({
        recherche: {
          personne: 'M. Leroy',
          budgetMin: null,
          budgetMax: 300000,
          surfaceMin: null,
          roomsMin: 2,
          villes: [],
          codesPostaux: ['44000'],
          typeBien: 'appartement',
        },
      }),
      [janine, leroy],
      BIENS,
    );
    assert.equal(r?.personneRef, 'p1');
    assert.deepEqual(
      r?.correspondances.map((c) => c.id),
      ['b2'],
    );
  });
});

describe('prospectPropose', () => {
  const etapes = [
    { id: 's1', cle: 'pris', libelle: 'Pris' },
    { id: 's5', cle: 'perdu', libelle: 'Perdu' },
  ];
  const leads = [{ id: 'l1', address: '14 rue Crébillon', banId: 'ban-cre', stageId: 's1' }];
  it('fait avancer le seul prospect de l’adresse', () => {
    const p = prospectPropose(ex({ prospect: { etape: 'perdu', motif: 'Pas vendeur' } }), 'ban-cre', leads, etapes);
    assert.equal(p?.leadId, 'l1');
    assert.equal(p?.stageLibelle, 'Perdu');
    assert.equal(p?.etapeActuelle, 'Pris');
  });
  it('ne propose rien sans adresse ou à étape identique', () => {
    assert.equal(prospectPropose(ex({ prospect: { etape: 'perdu', motif: null } }), null, leads, etapes), null);
    assert.equal(
      prospectPropose(ex({ prospect: { etape: 'perdu', motif: null } }), 'ban-cre', [{ ...leads[0]!, stageId: 's5' }], etapes),
      null,
    );
  });
});

describe('emailPropose', () => {
  it('reprend l’adresse e-mail du contact reconnu', () => {
    const e = emailPropose(ex({ email: { personne: 'Mme Martin', objet: 'Diagnostics', corps: 'Bonjour' } }), [janine, leroy]);
    assert.equal(e?.email, 'janine@exemple.fr');
    assert.equal(e?.destinataire, 'Janine Martin');
  });
  it('code les espaces pour la messagerie', () => {
    assert.equal(
      mailtoBrouillon({ email: 'a@b.fr', objet: 'Les diagnostics', corps: 'Bonjour Madame' }),
      'mailto:a%40b.fr?subject=Les%20diagnostics&body=Bonjour%20Madame',
    );
  });
});
