/**
 * Mention de consentement au rappel téléphonique.
 *
 * La règle juridique : ce qui est opposable, c'est le texte exact affiché à la
 * personne au moment où elle a coché. On garde donc trois choses ensemble —
 * le texte rendu, la version dont il vient, et son empreinte. Modifier la
 * mention plus tard crée une nouvelle version ; les preuves déjà écrites
 * gardent leur propre texte.
 */

import { createHash } from 'node:crypto';

/**
 * Version courante. Toute modification du corps ci-dessous DOIT s'accompagner
 * d'un nouvel identifiant et d'une ligne dans estimation_consent_versions.
 */
export const WIDGET_CONSENT_VERSION = 'widget-2026-08-v1';

const WIDGET_CONSENT_BODY =
  "J'accepte d'être recontacté par téléphone par {agence} au sujet de l'estimation de mon bien et de mon projet immobilier.";

export type ConsentSnapshot = {
  version: string;
  text: string;
  sha256: string;
};

/** Rend la mention pour une agence nommée. Le nom fait partie du texte opposable. */
export function renderWidgetConsentText(agencyName: string): string {
  const name = agencyName.trim() || "l'agence partenaire";
  return WIDGET_CONSENT_BODY.replace('{agence}', name);
}

export function widgetConsentSnapshot(agencyName: string): ConsentSnapshot {
  const text = renderWidgetConsentText(agencyName);
  return {
    version: WIDGET_CONSENT_VERSION,
    text,
    sha256: createHash('sha256').update(text, 'utf8').digest('hex'),
  };
}

/**
 * Le texte renvoyé par le navigateur doit correspondre exactement à celui que
 * le serveur affiche pour cette agence. Sinon, la preuve serait bâtie sur une
 * mention que nous n'avons pas maîtrisée.
 */
export function consentTextMatches(submitted: unknown, expected: string): boolean {
  return typeof submitted === 'string' && submitted.trim() === expected;
}

/** Mention légale affichée sous le formulaire, widget comme page complète. */
export const WIDGET_LEGAL_NOTICE =
  'Estimation indicative établie à partir de données publiques (transactions DVF, diagnostics ADEME, cadastre). ' +
  "Elle ne constitue ni une expertise ni un engagement de prix. Les coordonnées saisies sont transmises à l'agence " +
  'nommée ci-dessus, seule destinataire, et conservées trois ans. Vous disposez d\'un droit d\'accès, de rectification ' +
  'et de retrait de votre consentement à tout moment.';
