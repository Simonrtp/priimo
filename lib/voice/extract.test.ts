import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { EMPTY_CONTACT_INPUT } from '../contact-input';
import { joinVoiceTranscripts, mergeVoiceFields } from './extract';

describe('joinVoiceTranscripts', () => {
  it('assemble deux prises', () => {
    assert.equal(joinVoiceTranscripts('Jean Dupont', '06 12 34 56 78'), 'Jean Dupont\n\n06 12 34 56 78');
  });

  it('ignore une prise vide', () => {
    assert.equal(joinVoiceTranscripts('Jean', '  '), 'Jean');
    assert.equal(joinVoiceTranscripts('', 'Marie'), 'Marie');
  });
});

describe('mergeVoiceFields', () => {
  it('complète sans écraser ce qui était déjà dit', () => {
    const current = {
      ...EMPTY_CONTACT_INPUT,
      firstName: 'Jean',
      lastName: 'Dupont',
      type: 'vendeur' as const,
    };
    const incoming = {
      ...EMPTY_CONTACT_INPUT,
      phone: '0612345678',
      address: '12 rue des Lilas',
    };
    const merged = mergeVoiceFields(current, incoming);
    assert.equal(merged.firstName, 'Jean');
    assert.equal(merged.lastName, 'Dupont');
    assert.equal(merged.type, 'vendeur');
    assert.equal(merged.phone, '0612345678');
    assert.equal(merged.address, '12 rue des Lilas');
  });

  it('prend la nouvelle valeur quand elle est dite', () => {
    const current = { ...EMPTY_CONTACT_INPUT, firstName: 'Jean', phone: '0600000000' };
    const incoming = { ...EMPTY_CONTACT_INPUT, firstName: 'Jeanne', phone: '0611111111' };
    const merged = mergeVoiceFields(current, incoming);
    assert.equal(merged.firstName, 'Jeanne');
    assert.equal(merged.phone, '0611111111');
  });
});
