/**
 * Import ponctuel des contacts Google (contacts.readonly).
 *
 * Même client OAuth et même chiffrement que Gmail et l'Agenda. Rien n'est
 * gardé : le jeton attend au plus dix minutes, chiffré dans un cookie, le
 * temps de revenir sur la page Contacts ; on lit une fois, puis on le rend
 * à Google.
 */

import { decryptTokenPayload, encryptTokenPayload } from '@/lib/inbound/gmail';
import { oauthPublicOrigin } from '@/lib/agenda/google-calendar';
import type { PersonneGoogle } from '@/lib/import/google-contacts';
import { MAX_CONTACT_IMPORT_ROWS } from '@/lib/import/limits';

const SCOPES = ['https://www.googleapis.com/auth/contacts.readonly'] as const;

export const GOOGLE_CONTACTS_STATE_COOKIE = 'priimo_gcontacts_state';
export const GOOGLE_CONTACTS_JETON_COOKIE = 'priimo_gcontacts_jeton';
export const GOOGLE_CONTACTS_CALLBACK_PATH = '/api/dashboard/integrations/google-contacts/callback';
/** Seule route qui reçoit le cookie du jeton. */
export const GOOGLE_CONTACTS_LECTURE_PATH = '/api/dashboard/contacts/import/google';
export const GOOGLE_CONTACTS_JETON_DUREE_S = 600;

const PERSON_FIELDS = 'names,phoneNumbers,emailAddresses,addresses,organizations,biographies';
const PAR_PAGE = 1000;

export function googleContactsRedirectUri(req: Request): string {
  return `${oauthPublicOrigin(req)}${GOOGLE_CONTACTS_CALLBACK_PATH}`;
}

export function googleContactsAuthUrl(args: { clientId: string; redirectUri: string; state: string }): string {
  const params = new URLSearchParams({
    client_id: args.clientId,
    redirect_uri: args.redirectUri,
    response_type: 'code',
    scope: SCOPES.join(' '),
    // Une seule lecture : pas de jeton de rafraîchissement.
    access_type: 'online',
    // L'agent choisit le compte qui porte ses contacts (perso / pro).
    prompt: 'select_account',
    state: args.state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

/** `nonce.chiffré` en hexadécimal : le jeton ne voyage jamais en clair. */
export function scellerJeton(accessToken: string): string {
  const { ciphertext, nonce } = encryptTokenPayload({ access_token: accessToken });
  return `${nonce.toString('hex')}.${ciphertext.toString('hex')}`;
}

export function ouvrirJeton(valeur: string | undefined): string | null {
  if (!valeur) return null;
  const [nonce, chiffre] = valeur.split('.');
  if (!nonce || !chiffre) return null;
  try {
    const { access_token } = decryptTokenPayload<{ access_token: string }>(
      Buffer.from(chiffre, 'hex'),
      Buffer.from(nonce, 'hex'),
    );
    return access_token || null;
  } catch {
    return null;
  }
}

export class LectureGoogleError extends Error {
  constructor(
    message: string,
    readonly raison: 'expire' | 'api' | 'reseau',
  ) {
    super(message);
    this.name = 'LectureGoogleError';
  }
}

/** Toutes les fiches enregistrées du compte, page par page. */
export async function lireContactsGoogle(accessToken: string): Promise<PersonneGoogle[]> {
  const personnes: PersonneGoogle[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({ personFields: PERSON_FIELDS, pageSize: String(PAR_PAGE) });
    if (pageToken) params.set('pageToken', pageToken);
    let res: Response;
    try {
      res = await fetch(`https://people.googleapis.com/v1/people/me/connections?${params}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
      });
    } catch {
      throw new LectureGoogleError('Google injoignable', 'reseau');
    }
    if (res.status === 401) throw new LectureGoogleError('Jeton expiré', 'expire');
    if (!res.ok) {
      const texte = await res.text();
      throw new LectureGoogleError(`People API ${res.status} : ${texte.slice(0, 300)}`, 'api');
    }
    const data = (await res.json()) as { connections?: PersonneGoogle[]; nextPageToken?: string };
    personnes.push(...(data.connections ?? []));
    pageToken = data.nextPageToken;
  } while (pageToken && personnes.length < MAX_CONTACT_IMPORT_ROWS);
  return personnes.slice(0, MAX_CONTACT_IMPORT_ROWS);
}

/** On rend l'accès dès la lecture faite. Un échec ici ne gêne pas l'agent : le jeton expire seul. */
export async function rendreJeton(accessToken: string): Promise<void> {
  try {
    await fetch('https://oauth2.googleapis.com/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token: accessToken }),
    });
  } catch {
    /* expire de lui-même en une heure */
  }
}
