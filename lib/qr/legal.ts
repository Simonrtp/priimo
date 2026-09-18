import { createHash } from 'node:crypto';
import { absoluteUrl } from '@/lib/site-url';

export const QR_INFO_VERSION = 'qr-terrain-2026-09-v1';
export const QR_CONSENT_VERSION = 'qr-terrain-2026-09-v2';
export const PAGE_INFO_PATH = '/information';

const QR_INFO_FALLBACK =
  '{agence} enregistre les coordonnées que vous saisissez ici pour vous recontacter au sujet de votre bien.\n\n' +
  'Elles sont conservées trois ans à compter de notre dernier échange, et ne sont transmises à personne d\'autre.\n\n' +
  "Vous pouvez à tout moment y accéder, les corriger, les faire supprimer ou vous opposer à leur usage : {lien_information}";

const QR_CONSENT_FALLBACK =
  "J'accepte d'être recontacté par {agence} au sujet de la vente de mon bien.";

export type QrLegalSnapshot = {
  infoVersion: string;
  infoText: string;
  consentVersion: string;
  consentText: string;
  consentSha256: string;
  agenceNom: string;
};

export function fillLegalTemplate(
  corps: string,
  vars: { agence: string; agent?: string; lienInformation?: string },
): string {
  const lien = vars.lienInformation ?? absoluteUrl(PAGE_INFO_PATH);
  return corps
    .replaceAll('{agence}', vars.agence)
    .replaceAll('{agent}', vars.agent ?? '')
    .replaceAll('{lien_information}', lien)
    .replaceAll('{lien_portail}', lien);
}

export function sha256Text(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

export function qrLegalSnapshot(args: {
  agenceNom: string;
  agentPrenom?: string;
  infoCorps?: string | null;
  consentCorps?: string | null;
}): QrLegalSnapshot {
  const agenceNom = args.agenceNom.trim() || 'l’agence';
  const infoText = fillLegalTemplate(args.infoCorps?.trim() || QR_INFO_FALLBACK, {
    agence: agenceNom,
    agent: args.agentPrenom?.trim() || '',
  });
  const consentText = fillLegalTemplate(args.consentCorps?.trim() || QR_CONSENT_FALLBACK, {
    agence: agenceNom,
  });
  return {
    infoVersion: QR_INFO_VERSION,
    infoText,
    consentVersion: QR_CONSENT_VERSION,
    consentText,
    consentSha256: sha256Text(consentText),
    agenceNom,
  };
}
