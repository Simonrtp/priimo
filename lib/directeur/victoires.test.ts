import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  quandVictoire,
  victoiresDeLaSemaine,
  type BienPourVictoire,
  type ContactPourVictoire,
  type LeadPourVictoire,
} from './victoires';

const semaine = { debut: '2026-10-19', fin: '2026-10-25' };
const prenoms = new Map([['simon', 'Simon']]);

function lead(over: Partial<LeadPourVictoire> = {}): LeadPourVictoire {
  return {
    id: 'lead-1',
    address: '12 rue Oberkampf',
    city: 'Paris',
    postalCode: '75011',
    propertyType: 'appartement',
    surfaceM2: 45,
    rooms: 2,
    etage: '3',
    dpeClass: 'F',
    acquiredYear: 2014,
    acquiredPrice: 167_000,
    acquiredPriceReliable: true,
    ownerName: 'Camille Martin',
    ownerPhone: '0612345678',
    ownerPhoneSource: 'cible',
    ownerType: 'particulier',
    companyName: null,
    companyDirector: null,
    companyPhone: null,
    companyEmail: null,
    banId: 'ban-1',
    ...over,
  };
}

function bien(over: Partial<BienPourVictoire> = {}): BienPourVictoire {
  return {
    id: 'bien-1',
    leadId: 'lead-1',
    banId: 'ban-1',
    address: '12 rue Oberkampf',
    city: 'Paris',
    postalCode: '75011',
    propertyType: 'appartement',
    surfaceM2: 45,
    rooms: 2,
    price: 538_000,
    mandatStatut: 'mandat_exclusif',
    proprietaireContactId: 'contact-1',
    proprietaireName: 'Camille Martin',
    proprietairePhone: '0612345678',
    proprietaireEmail: 'camille@example.com',
    ...over,
  };
}

function contact(over: Partial<ContactPourVictoire> = {}): ContactPourVictoire {
  return {
    id: 'contact-1',
    leadId: 'lead-1',
    fullName: 'Camille Martin',
    phone: '0612345678',
    email: 'camille@example.com',
    type: 'vendeur',
    ...over,
  };
}

describe('victoiresDeLaSemaine', () => {
  it('relie le mandat au bien, à la date et au contact déjà connus', () => {
    const [victoire] = victoiresDeLaSemaine({
      transitions: [
        {
          leadId: 'lead-1',
          profileId: 'simon',
          versCle: 'mandat',
          createdAt: '2026-10-22T12:30:00.000Z',
        },
      ],
      semaine,
      prenoms,
      leads: [lead()],
      biens: [bien()],
      contacts: [contact()],
    });

    assert.equal(victoire?.prenom, 'Simon');
    assert.equal(victoire?.label, 'mandat signé');
    assert.equal(victoire?.adresse, '12 rue Oberkampf, 75011 Paris');
    assert.equal(victoire?.leadId, 'lead-1');
    assert.equal(victoire?.bien?.id, 'bien-1');
    assert.equal(victoire?.bien?.precisions, 'Appartement · 45 m² · 2 pièces · 3e étage · DPE F');
    assert.match(victoire?.bien?.prix ?? '', /538/);
    assert.match(victoire?.bien?.achat ?? '', /2014/);
    assert.match(victoire?.bien?.achat ?? '', /167/);
    assert.equal(victoire?.bien?.mandat, 'Mandat exclusif');
    assert.deepEqual(victoire?.contacts, [
      {
        id: 'contact-1',
        nom: 'Camille Martin',
        telephone: '06 12 34 56 78',
        email: 'camille@example.com',
        role: 'Vendeur',
      },
    ]);
    assert.match(quandVictoire(victoire?.quand ?? ''), /22/);
    assert.match(quandVictoire(victoire?.quand ?? ''), /14:30|14 h 30/);
  });

  it('garde le propriétaire du lead quand aucune fiche contact n’est liée', () => {
    const [victoire] = victoiresDeLaSemaine({
      transitions: [
        {
          leadId: 'lead-1',
          profileId: 'simon',
          versCle: 'rendez_vous',
          createdAt: '2026-10-20T08:00:00.000Z',
        },
      ],
      semaine,
      prenoms,
      leads: [
        lead({
          ownerPhoneSource: 'probable',
          ownerPhone: '0699999999',
          acquiredPrice: null,
          acquiredPriceReliable: null,
        }),
      ],
      biens: [],
      contacts: [],
    });

    assert.equal(victoire?.label, 'rendez-vous obtenu');
    assert.equal(victoire?.bien?.id, null);
    assert.equal(victoire?.bien?.prix, null);
    assert.equal(victoire?.bien?.achat, null);
    assert.equal(victoire?.bien?.mandat, null);
    assert.equal(victoire?.contacts?.[0]?.nom, 'Camille Martin');
    assert.equal(victoire?.contacts?.[0]?.id, null);
    assert.equal(victoire?.contacts?.[0]?.telephone, null);
    assert.equal(victoire?.contacts?.[0]?.role, 'Propriétaire');
  });

  it('ne devine pas le bien quand plusieurs fiches partagent la même adresse', () => {
    const [victoire] = victoiresDeLaSemaine({
      transitions: [
        {
          leadId: 'lead-1',
          profileId: 'simon',
          versCle: 'mandat',
          createdAt: '2026-10-21T10:00:00.000Z',
        },
      ],
      semaine,
      prenoms,
      leads: [lead()],
      biens: [
        bien({ id: 'a', leadId: null, price: 100_000 }),
        bien({ id: 'b', leadId: null, price: 200_000 }),
      ],
      contacts: [],
    });

    assert.equal(victoire?.bien?.id, null);
    assert.equal(victoire?.bien?.prix, null);
    assert.equal(victoire?.adresse, '12 rue Oberkampf, 75011 Paris');
  });

  it('ignore ce qui tombe hors de la semaine parisienne et classe les plus récentes d’abord', () => {
    const victoires = victoiresDeLaSemaine({
      transitions: [
        {
          leadId: 'ancien',
          profileId: 'simon',
          versCle: 'mandat',
          createdAt: '2026-10-18T21:30:00.000Z',
        },
        {
          leadId: 'lundi',
          profileId: 'simon',
          versCle: 'rendez_vous',
          createdAt: '2026-10-18T22:30:00.000Z',
        },
        {
          leadId: 'vendredi',
          profileId: 'simon',
          versCle: 'mandat',
          createdAt: '2026-10-23T15:00:00.000Z',
        },
      ],
      semaine,
      prenoms,
      leads: [],
      biens: [],
      contacts: [],
    });

    assert.deepEqual(
      victoires.map((v) => v.leadId),
      ['vendredi', 'lundi'],
    );
    assert.deepEqual(victoires[0]?.contacts, []);
    assert.equal(victoires[0]?.adresse, null);
    assert.equal(victoires[0]?.bien, null);
  });
});
