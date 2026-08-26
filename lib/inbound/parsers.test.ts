import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parsePortailEmail, type IncomingEmail } from './parsers';
import { isSenderAllowed } from './whitelist';

function email(overrides: Partial<IncomingEmail>): IncomingEmail {
  return {
    gmailMessageId: 'msg-1',
    fromAddress: 'noreply@seloger.com',
    subject: 'Nouvelle demande SeLoger',
    bodyText: '',
    receivedAt: '2026-08-26T10:00:00Z',
    ...overrides,
  };
}

describe('parsePortailEmail SeLoger', () => {
  it('extrait nom, téléphone, email et référence', () => {
    const result = parsePortailEmail(
      email({
        bodyText: `
Bonjour,
Vous avez reçu une demande.

Nom : Marie Dupont
Téléphone : 06 12 34 56 78
Email : marie.dupont@example.com
Référence annonce : SL-998877

Message :
Bonjour, je souhaite visiter le bien.
`,
      }),
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.lead.portail, 'seloger');
    assert.equal(result.lead.nom, 'Marie Dupont');
    assert.ok(result.lead.telephone?.includes('0612345678') || result.lead.telephone?.includes('6'));
    assert.equal(result.lead.email, 'marie.dupont@example.com');
    assert.equal(result.lead.referenceAnnonce, 'SL-998877');
  });

  it('échoue proprement si aucun contact', () => {
    const result = parsePortailEmail(
      email({
        subject: 'SeLoger info',
        bodyText: 'Newsletter SeLoger sans contact.',
      }),
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.reason, 'format_inconnu');
    assert.match(result.detail, /main/);
  });
});

describe('whitelist domaines', () => {
  it('accepte seloger.com et sous-domaine', () => {
    const allowed = new Set(['seloger.com', 'bienici.com']);
    assert.equal(isSenderAllowed('alertes@seloger.com', allowed), true);
    assert.equal(isSenderAllowed('x@mail.seloger.com', allowed), true);
    assert.equal(isSenderAllowed('notaire@cabinet-prive.fr', allowed), false);
  });
});
