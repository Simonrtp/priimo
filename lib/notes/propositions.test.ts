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
