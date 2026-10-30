import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { champsDuDraft, emailDit, lectureLocale, parseContactVoice, telephoneDit } from './voice-extract';

describe('dictée de contact — lecture locale', () => {
  it('lit un téléphone dicté en chiffres, quel que soit le groupement', () => {
    assert.equal(telephoneDit('Sophie Dubois, son numéro c’est le 06 12 34 56 78'), '06 12 34 56 78');
    assert.equal(telephoneDit('appelle le 0612345678 demain'), '06 12 34 56 78');
    assert.equal(telephoneDit('+33 6 12 34 56 78'), '06 12 34 56 78');
    assert.equal(telephoneDit('06.12.34.56.78'), '06 12 34 56 78');
  });

  it('lit un téléphone dicté chiffre par chiffre', () => {
    assert.equal(
      telephoneDit('son numéro zéro six douze trente quatre'),
      null,
      'des nombres à deux chiffres ne font pas un numéro sûr',
    );
    assert.equal(telephoneDit('zéro six un deux trois quatre cinq six sept huit'), '06 12 34 56 78');
  });

  it('ne prend pas un prix ou un code postal pour un numéro', () => {
    assert.equal(telephoneDit('budget 450000 euros, 75011 Paris'), null);
  });

  it('lit un e-mail, même dicté « arobase / point »', () => {
    assert.equal(emailDit('écris à sophie.dubois@gmail.com'), 'sophie.dubois@gmail.com');
    assert.equal(emailDit('sophie arobase gmail point com'), 'sophie@gmail.com');
    assert.equal(emailDit('pas d’adresse ici, juste un point'), null);
    assert.equal(emailDit('sophie.dubois arobase gmail point com'), 'sophie.dubois@gmail.com');
  });

  it('ne remplit jamais le consentement', () => {
    const l = lectureLocale('06 12 34 56 78 sophie@gmail.com elle est d’accord pour être rappelée');
    assert.equal('numeroCommuniqueParLaPersonne' in l, false);
    assert.deepEqual(champsDuDraft(l).sort(), ['email', 'phone']);
  });
});

describe('dictée de contact — lecture du modèle', () => {
  it('remplit la fiche, rôles cumulés compris', () => {
    const d = parseContactVoice(
      JSON.stringify({
        prenom: 'sophie',
        nom: 'dubois-martin',
        roles: ['vendeur', 'acquereur', 'vendeur', 'martien'],
        telephone: '06 12 34 56 78',
        email: 'S.Dubois@Gmail.com',
        adresse: '12 rue Oberkampf, 75011 Paris',
        secteur: '11e',
        code_postaux: ['75011', 'abc'],
        budget_max: '450 000',
        pieces_min: 3,
        resume: 'Veut vendre son T2 avant l’été.',
        relance: '2026-11-05',
      }),
    );
    assert.equal(d.firstName, 'Sophie');
    assert.equal(d.lastName, 'Dubois-Martin');
    assert.equal(d.type, 'vendeur');
    assert.deepEqual(d.autresTypes, ['acquereur']);
    assert.equal(d.phone, '06 12 34 56 78');
    assert.equal(d.email, 's.dubois@gmail.com');
    assert.deepEqual(d.postalCodes, ['75011']);
    assert.equal(d.budgetMax, 450_000);
    assert.equal(d.roomsMin, 3);
    assert.equal(d.recontacterLe, '2026-11-05');
  });

  it('calcule « jeudi prochain » lui-même, sans croire la date du modèle', () => {
    // Vendredi 30 octobre 2026.
    const d = parseContactVoice(
      JSON.stringify({ nom: 'Dubois', relance_quand: 'jeudi prochain', relance: '2026-11-06' }),
      new Date('2026-10-30T10:00:00+01:00'),
    );
    assert.equal(d.recontacterLe, '2026-11-05');
  });

  it('écarte ce qui est douteux, et un JSON cassé donne une fiche vide', () => {
    assert.deepEqual(parseContactVoice('pas du json'), {});
    const d = parseContactVoice(JSON.stringify({ email: 'pas un mail', relance: 'jeudi', budget_max: -4, roles: [] }));
    assert.deepEqual(champsDuDraft(d), []);
  });
});
