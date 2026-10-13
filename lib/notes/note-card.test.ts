import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resumeCarteNote } from './note-card';

describe('resumeCarteNote', () => {
  it('préfère le constat utile à la transcription technique', () => {
    const resume = resumeCarteNote({
      transcript: 'Information Source : Propriétaire Adresse : 56 rue Stendhal',
      adresseNormalisee: '56 rue Stendhal, 75020 Paris',
      structured: { observations: ['Le voisin du 6 connaît bien le propriétaire.'] },
    });
    assert.equal(resume.texte, 'Le voisin du 6 connaît bien le propriétaire.');
    assert.equal(resume.contact, null);
  });

  it('présente les coordonnées réellement extraites pour un contact', () => {
    const resume = resumeCarteNote({
      transcript: 'J’ai rencontré Jeanne Martin.',
      adresseNormalisee: null,
      structured: {
        address: '12 rue des Lilas, Paris',
        personnes: [
          {
            firstName: 'Jeanne',
            lastName: 'Martin',
            phone: '0612345678',
            email: 'jeanne@example.fr',
          },
        ],
      },
    });
    assert.deepEqual(resume.contact, {
      nom: 'Jeanne Martin',
      telephone: '0612345678',
      email: 'jeanne@example.fr',
      adresse: '12 rue des Lilas, Paris',
    });
  });

  it('coupe proprement une information longue', () => {
    const resume = resumeCarteNote({
      transcript: 'Une information très longue '.repeat(12),
      adresseNormalisee: null,
    });
    assert.ok(resume.texte.endsWith('…'));
    assert.ok(resume.texte.length <= 121);
  });
});
