import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  consentTextMatches,
  renderWidgetConsentText,
  widgetConsentSnapshot,
  WIDGET_CONSENT_VERSION,
} from './consent';

describe('mention de consentement du widget', () => {
  it('nomme explicitement l’agence et le rappel téléphonique', () => {
    const texte = renderWidgetConsentText('Agence du Port');
    assert.ok(texte.includes('Agence du Port'));
    assert.ok(texte.includes('téléphone'));
  });

  it('ne laisse jamais le gabarit apparaître tel quel', () => {
    assert.ok(!renderWidgetConsentText('').includes('{agence}'));
    assert.ok(renderWidgetConsentText('   ').includes('agence partenaire'));
  });

  it('empreinte le texte rendu, pas le gabarit', () => {
    const a = widgetConsentSnapshot('Agence A');
    const b = widgetConsentSnapshot('Agence B');
    assert.equal(a.version, WIDGET_CONSENT_VERSION);
    assert.notEqual(a.sha256, b.sha256);
    assert.equal(a.sha256.length, 64);
  });

  it('refuse un texte qui n’est pas celui affiché', () => {
    const { text } = widgetConsentSnapshot('Agence du Port');
    assert.equal(consentTextMatches(text, text), true);
    assert.equal(consentTextMatches(`  ${text}  `, text), true);
    assert.equal(consentTextMatches('J’accepte tout', text), false);
    assert.equal(consentTextMatches(undefined, text), false);
  });
});
