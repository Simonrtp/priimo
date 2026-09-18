import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  composeTypedNote,
  EMPTY_TYPED_NOTE_DRAFT,
  parseTypedNoteDraft,
  showsSource,
} from './typed-compose';

describe('parseTypedNoteDraft', () => {
  it('refuse un kind inconnu', () => {
    assert.equal(parseTypedNoteDraft({ kind: 'voisin' }), null);
  });

  it('ignore les anciens champs de création d’entité', () => {
    const draft = parseTypedNoteDraft({
      kind: 'vendeur',
      sourceInfo: 'hacker',
      firstName: 'Marlène',
      phone: '0612345678',
      surface: '30',
      body: 'Elle veut vendre.',
    });
    assert.ok(draft);
    assert.equal(draft.kind, 'vendeur');
    assert.equal(draft.sourceInfo, '');
    assert.equal(draft.body, 'Elle veut vendre.');
    assert.equal('firstName' in draft, false);
    assert.equal('phone' in draft, false);
  });
});

describe('composeTypedNote', () => {
  it('n’extrait ni personne ni bien', () => {
    const { transcript, extraction } = composeTypedNote(
      {
        ...EMPTY_TYPED_NOTE_DRAFT,
        kind: 'vendeur',
        body: 'Appartement au 6 rue des Maronites.',
      },
      '6 rue des Maronites, Paris',
    );
    assert.match(transcript, /^Vendeur\n/);
    assert.match(transcript, /Immeuble : 6 rue des Maronites/);
    assert.doesNotMatch(transcript, /Tél/);
    assert.doesNotMatch(transcript, /m²/);
    assert.equal(extraction.personnes.length, 0);
    assert.equal(extraction.surface, null);
    assert.equal(extraction.rooms, null);
    assert.equal(extraction.prix, null);
    assert.equal(extraction.address, '6 rue des Maronites, Paris');
  });

  it('ne pose une source que pour une information', () => {
    const proprio = composeTypedNote({
      ...EMPTY_TYPED_NOTE_DRAFT,
      kind: 'note_proprietaire',
      sourceInfo: 'proprietaire',
      body: 'Pas vendeur pour le moment.',
    });
    assert.equal(proprio.extraction.sourceInfo, null);
    assert.doesNotMatch(proprio.transcript, /Source/);

    const info = composeTypedNote({
      ...EMPTY_TYPED_NOTE_DRAFT,
      kind: 'information',
      sourceInfo: 'gardien',
      body: 'Travaux dans la cage en septembre.',
    });
    assert.equal(info.extraction.sourceInfo, 'gardien');
    assert.match(info.transcript, /Source : Gardien/);
  });
});

describe('champs selon le kind', () => {
  it('montre la source seulement pour une information', () => {
    assert.equal(showsSource('information'), true);
    assert.equal(showsSource('note_proprietaire'), false);
    assert.equal(showsSource('vendeur'), false);
  });
});
