/**
 * OAuth Google Calendar (calendar.readonly) + lecture de la semaine.
 *
 * Même client OAuth et même chiffrement AES-GCM que Gmail
 * (GOOGLE_OAUTH_* + GMAIL_TOKEN_ENCRYPTION_KEY). Redirect URI distincte.
 */

import {
  asEncryptedBuffer,
  decryptTokenPayload,
  encryptTokenPayload,
  refreshGoogleAccessToken,
} from '@/lib/inbound/gmail';
import { dateKeyParis } from '@/lib/today/calendar';
import type { createSupabaseAdminClient } from '@/lib/supabase/admin';
import type { AgendaEvenement } from './types';

export type { AgendaEvenement } from './types';

const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'] as const;

export const CALENDAR_OAUTH_SCOPES = SCOPES;
export const CALENDAR_OAUTH_STATE_COOKIE = 'priimo_cal_oauth_state';

export const CALENDAR_VERIFICATION_NOTE =
  'calendar.readonly est un scope sensible Google. Prévoir la vérification OAuth ' +
  'avant un déploiement au-delà de 100 utilisateurs de test.';

function estOrigineLocale(origin: string): boolean {
  try {
    const host = new URL(origin.includes('://') ? origin : `http://${origin}`).hostname;
    return host === 'localhost' || host === '127.0.0.1';
  } catch {
    return false;
  }
}

/** Hôte vu par le navigateur (Vercel pose x-forwarded-*). */
export function origineDeLaRequete(req: Request): string {
  const url = new URL(req.url);
  const proto =
    req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() || url.protocol.replace(':', '');
  const host =
    req.headers.get('x-forwarded-host')?.split(',')[0]?.trim() ||
    req.headers.get('host') ||
    url.host;
  return `${proto}://${host}`;
}

/**
 * Callback OAuth = l’hôte où l’agent a cliqué.
 * Sinon, avec SITE_URL=priimo.fr et un redirect localhost en env, Google
 * renvoie sur la machine locale : cookie perdu, « Connexion Agenda impossible ».
 */
export function oauthPublicOrigin(req: Request): string {
  const vue = origineDeLaRequete(req);
  if (estOrigineLocale(vue)) return vue;
  const site = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '').trim();
  if (site && !estOrigineLocale(site)) return site;
  return vue;
}

export function calendarOAuthRedirectUri(req: Request): string {
  const explicite = process.env.GOOGLE_CALENDAR_OAUTH_REDIRECT_URI?.trim();
  const origin = oauthPublicOrigin(req);
  if (explicite) {
    try {
      const force = new URL(explicite);
      const forceOrigin = force.origin;
      // Un redirect localhost n’a de sens que si on est vraiment en local.
      if (estOrigineLocale(forceOrigin) && !estOrigineLocale(origin)) {
        return `${origin}/api/dashboard/integrations/calendar/callback`;
      }
      if (force.pathname.length > 1) return explicite.replace(/\/$/, '');
    } catch {
      /* env illisible : on ignore */
    }
  }
  return `${origin}/api/dashboard/integrations/calendar/callback`;
}

export function calendarOAuthAuthUrl(args: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const params = new URLSearchParams({
    client_id: args.clientId,
    redirect_uri: args.redirectUri,
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline',
    // select_account : l'agent choisit parmi ses comptes Google (perso / pro).
    prompt: 'select_account consent',
    state: args.state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export type CalendarTokens = {
  access_token: string;
  refresh_token?: string;
  expires_at?: number | null;
};

export function encryptCalendarTokens(tokens: CalendarTokens): {
  ciphertext: Buffer;
  nonce: Buffer;
} {
  return encryptTokenPayload(tokens);
}

type GoogleEvent = {
  id?: string;
  summary?: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
};

export async function fetchCalendarPrimary(accessToken: string): Promise<{ id: string }> {
  const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Calendar primary failed: ${text.slice(0, 300)}`);
  }
  const data = (await res.json()) as { id?: string };
  if (!data.id) throw new Error('Agenda principal introuvable');
  return { id: data.id };
}

function heureParis(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));
}

export function normaliserEvenements(items: readonly GoogleEvent[]): AgendaEvenement[] {
  const out: AgendaEvenement[] = [];
  for (const ev of items) {
    if (!ev.id) continue;
    const startDate = ev.start?.date;
    const startDt = ev.start?.dateTime;
    if (startDate) {
      out.push({
        id: ev.id,
        titre: ev.summary?.trim() || 'Sans titre',
        jour: startDate,
        debut: null,
        fin: null,
        journee: true,
      });
      continue;
    }
    if (!startDt) continue;
    out.push({
      id: ev.id,
      titre: ev.summary?.trim() || 'Sans titre',
      jour: dateKeyParis(new Date(startDt)),
      debut: heureParis(startDt),
      fin: ev.end?.dateTime ? heureParis(ev.end.dateTime) : null,
      journee: false,
    });
  }
  return out;
}

export async function fetchCalendarEvents(args: {
  accessToken: string;
  timeMin: string;
  timeMax: string;
}): Promise<AgendaEvenement[]> {
  const params = new URLSearchParams({
    timeMin: args.timeMin,
    timeMax: args.timeMax,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '80',
    fields: 'items(id,summary,start,end)',
  });
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
    {
      headers: { Authorization: `Bearer ${args.accessToken}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(4_000),
    },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Calendar events failed: ${text.slice(0, 300)}`);
  }
  const data = (await res.json()) as { items?: GoogleEvent[] };
  return normaliserEvenements(data.items ?? []);
}

type Admin = ReturnType<typeof createSupabaseAdminClient>;

/**
 * Access token utilisable, avec refresh si le jeton expire dans la minute.
 */
export async function accessTokenAgenda(args: {
  admin: Admin;
  row: {
    id: string;
    token_ciphertext: unknown;
    token_nonce: unknown;
  };
}): Promise<string> {
  const cipher = asEncryptedBuffer(args.row.token_ciphertext);
  const nonce = asEncryptedBuffer(args.row.token_nonce);
  const tokens = decryptTokenPayload<CalendarTokens>(cipher, nonce);
  const expireBientot =
    typeof tokens.expires_at === 'number' && tokens.expires_at < Date.now() + 60_000;

  if (!expireBientot) return tokens.access_token;
  if (!tokens.refresh_token) return tokens.access_token;

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return tokens.access_token;

  const refreshed = await refreshGoogleAccessToken({
    refreshToken: tokens.refresh_token,
    clientId,
    clientSecret,
  });
  const next: CalendarTokens = {
    access_token: refreshed.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: refreshed.expires_in ? Date.now() + refreshed.expires_in * 1000 : null,
  };
  const sealed = encryptCalendarTokens(next);
  await args.admin
    .from('calendar_connexions')
    .update({
      token_ciphertext: `\\x${sealed.ciphertext.toString('hex')}`,
      token_nonce: `\\x${sealed.nonce.toString('hex')}`,
      etat: 'actif',
      dernier_erreur: null,
    })
    .eq('id', args.row.id);

  return next.access_token;
}
