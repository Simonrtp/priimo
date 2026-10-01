import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { asRooms, lignesFicheNote, parseNoteExtraction } from './propositions';

describe('parseNoteExtraction', () => {
  it('reprend le bien sous le contact : T2, prix, adresse', () => {
    const parsed = parseNoteExtraction(
      JSON.stringify({
        personnes: [{ firstName: 'Maëlys', lastName: '', type: 'vendeur' }],
        address: '6 rue Orphila',
        secteur: 'Paris 20',
        prix: 400000,
        rooms: 'T2',
        source_info: 'proprietaire',
      }),
    );
    assert.equal(parsed.personnes[0]?.firstName, 'Maëlys');
    assert.equal(parsed.personnes[0]?.type, 'vendeur');
    assert.equal(parsed.address, '6 rue Orphila');
    assert.equal(parsed.secteur, 'Paris 20');
    assert.equal(parsed.prix, 400000);
    assert.equal(parsed.rooms, 2);
    assert.equal(parsed.sourceInfo, 'proprietaire');
  });

  it('reste lisible si les champs bien manquent (ancienne extraction)', () => {
    const parsed = parseNoteExtraction(
      JSON.stringify({
        personnes: [{ firstName: 'Jean', lastName: 'Dupont', type: 'acquereur' }],
        address: '12 rue des Lilas',
      }),
    );
    assert.equal(parsed.prix, null);
    assert.equal(parsed.rooms, null);
    assert.equal(parsed.surface, null);
    assert.equal(parsed.secteur, null);
  });
});

describe('parseNoteExtraction — formes que rendent les petits modèles', () => {
  it('recolle une adresse rendue en objet au lieu d’une chaîne', () => {
    const parsed = parseNoteExtraction(
      JSON.stringify({
        personnes: [],
        address: { street: '161 avenue Ledru-Rolin', city: 'Paris', postalCode: '75011' },
      }),
    );
    assert.equal(parsed.address, '161 avenue Ledru-Rolin 75011 Paris');
  });

  it('accepte les énumérés accentués', () => {
    const parsed = parseNoteExtraction(
      JSON.stringify({
        personnes: [{ firstName: 'Bertrand', lastName: null, type: 'acquéreur' }],
        source_info: 'Propriétaire',
      }),
    );
    assert.equal(parsed.personnes[0]?.type, 'acquereur');
    assert.equal(parsed.sourceInfo, 'proprietaire');
  });

  it('remet les majuscules et laisse la particule en minuscule', () => {
    const parsed = parseNoteExtraction(
      JSON.stringify({
        personnes: [{ firstName: 'catherine', lastName: 'de villeneuve', type: 'acquereur' }],
      }),
    );
    assert.equal(parsed.personnes[0]?.firstName, 'Catherine');
    assert.equal(parsed.personnes[0]?.lastName, 'de Villeneuve');
  });

  it('ne fait pas un contact d’un rôle sans patronyme', () => {
    const parsed = parseNoteExtraction(
      JSON.stringify({
        personnes: [
          { firstName: null, lastName: 'gardien', type: 'gardien' },
          { firstName: 'Propriétaire', lastName: null, type: 'vendeur' },
        ],
      }),
    );
    assert.deepEqual(parsed.personnes, []);
  });

  it('garde un rôle qui vient avec un téléphone', () => {
    const parsed = parseNoteExtraction(
      JSON.stringify({
        personnes: [{ firstName: null, lastName: 'gardien', phone: '0611223344', type: 'gardien' }],
      }),
    );
    assert.equal(parsed.personnes.length, 1);
    assert.equal(parsed.personnes[0]?.phone, '0611223344');
  });

  it('lit un rendez-vous rendu en tableau et complète l’heure de fin', () => {
    const parsed = parseNoteExtraction(
      JSON.stringify({
        personnes: [],
        rendez_vous: [{ debut_iso: '2026-09-15T15:00', type: 'estimation' }],
      }),
    );
    assert.equal(parsed.rendezVous?.type, 'estimation');
    assert.equal(
      Date.parse(parsed.rendezVous!.fin) - Date.parse(parsed.rendezVous!.debut),
      3_600_000,
    );
  });

  it('survit à personnes: null', () => {
    const parsed = parseNoteExtraction(JSON.stringify({ personnes: null, prix: 410000 }));
    assert.deepEqual(parsed.personnes, []);
    assert.equal(parsed.prix, 410000);
  });
});

describe('asRooms', () => {
  it('lit T2 et un entier', () => {
    assert.equal(asRooms('T2'), 2);
    assert.equal(asRooms(3), 3);
    assert.equal(asRooms('4 pièces'), 4);
  });
});

describe('lignesFicheNote', () => {
  it('affiche le type, le prix et l’adresse sous le nom', () => {
    const prix = `${new Intl.NumberFormat('fr-FR').format(400000)} €`;
    assert.deepEqual(
      lignesFicheNote({
        address: '6 rue Orphila',
        secteur: 'Paris 20',
        prix: 400000,
        rooms: 2,
        surface: null,
      }),
      [`T2 · ${prix}`, '6 rue Orphila · Paris 20'],
    );
  });
});

describe('parseNoteExtraction v2 — actions multiples', () => {
  const REF = new Date('2026-09-30T10:00:00Z'); // mercredi

  it('garde chaque engagement, pas seulement le premier', () => {
    const parsed = parseNoteExtraction(
      JSON.stringify({
        personnes: [],
        actions: [
          { type: 'rappel', intitule: 'Rappeler Janine', date_iso: '2026-10-02' },
          { type: 'tache', intitule: 'Envoyer le mandat à M. Martin', date_iso: '2026-10-01' },
          { type: 'rdv', intitule: 'Estimation chez les Petit', date_iso: '2026-10-06', heure: '14h30', rdv_type: 'estimation' },
        ],
      }),
      REF,
    );
    assert.equal(parsed.actions?.length, 3);
    assert.equal(parsed.actions?.[2]?.heure, '14:30');
    // Compatibilité : les anciens champs restent remplis.
    assert.equal(parsed.promesse?.intitule, 'Rappeler Janine');
    assert.equal(parsed.rendezVous?.type, 'estimation');
    assert.equal(parsed.rendezVous?.debut, '2026-10-06T12:30:00.000Z');
  });

  it('fait d’un RDV sans jour une tâche à caler', () => {
    const parsed = parseNoteExtraction(
      JSON.stringify({ actions: [{ type: 'rdv', intitule: 'Caler une visite', date_iso: null }] }),
      REF,
    );
    assert.equal(parsed.actions?.[0]?.type, 'tache');
  });

  it('lit une baisse de prix dite en milliers', () => {
    const parsed = parseNoteExtraction(
      JSON.stringify({ mises_a_jour: [{ champ: 'prix', valeur: 450, bien: 'rue des Lilas' }] }),
    );
    assert.deepEqual(parsed.misesAJour, [{ champ: 'prix', valeur: 450000, bien: 'rue des Lilas' }]);
  });

  it('écarte un statut de mandat inconnu', () => {
    const parsed = parseNoteExtraction(
      JSON.stringify({ mises_a_jour: [{ champ: 'statut_mandat', valeur: 'presque signé' }] }),
    );
    assert.deepEqual(parsed.misesAJour, []);
  });

  it('lit la recherche d’un acquéreur et ignore une recherche vide', () => {
    const parsed = parseNoteExtraction(
      JSON.stringify({
        recherche: { personne: 'M. Leroy', budget_max: 320, pieces_min: 'T3', codes_postaux: ['44000', 'Nantes'] },
      }),
    );
    assert.equal(parsed.recherche?.budgetMax, 320000);
    assert.equal(parsed.recherche?.roomsMin, 3);
    assert.deepEqual(parsed.recherche?.codesPostaux, ['44000']);
    assert.equal(parseNoteExtraction(JSON.stringify({ recherche: { villes: [] } })).recherche, null);
  });

  it('lit un prospect perdu avec son motif, et un e-mail complet', () => {
    const parsed = parseNoteExtraction(
      JSON.stringify({
        intention: 'note',
        prospect: { etape: 'perdu', motif: 'Pas vendeur avant 2028' },
        email: { personne: 'Mme Durand', objet: 'Diagnostics', corps: 'Bonjour Madame, …' },
      }),
    );
    assert.deepEqual(parsed.prospect, { etape: 'perdu', motif: 'Pas vendeur avant 2028' });
    assert.equal(parsed.email?.objet, 'Diagnostics');
  });

  it('reconnaît une question à l’assistant', () => {
    assert.equal(parseNoteExtraction(JSON.stringify({ intention: 'question' })).intention, 'question');
    assert.equal(parseNoteExtraction(JSON.stringify({})).intention, 'note');
  });
});
