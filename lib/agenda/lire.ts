import { cache } from 'react';
import { getServerUser } from '@/lib/auth/getServerUser';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { accessTokenAgenda, fetchCalendarEvents } from '@/lib/agenda/google-calendar';
import { bornesDeCle, cleAgenda, cleValide } from '@/lib/agenda/vues';
import { dateKeyParis } from '@/lib/today/calendar';
import type { AgendaEvenement, AgendaReponse } from '@/lib/agenda/types';

export type { AgendaReponse };

type ConnexionRow = {
  id: string;
  etat: string;
  calendar_email: string | null;
  token_ciphertext: unknown;
  token_nonce: unknown;
};

type ConnexionChargee = {
  admin: ReturnType<typeof createSupabaseAdminClient>;
  userEmail: string | null;
  row: ConnexionRow | null;
};

const chargerConnexion = cache(async (): Promise<ConnexionChargee> => {
  const { user, profile, agency } = await getServerUser();
  const admin = createSupabaseAdminClient();
  if (!profile || !agency) {
    return { admin, userEmail: user?.email ?? null, row: null };
  }

  const { data } = await admin
    .from('calendar_connexions')
    .select('id, etat, calendar_email, token_ciphertext, token_nonce')
    .eq('agency_id', agency.id)
    .eq('profile_id', profile.id)
    .maybeSingle();

  return {
    admin,
    userEmail: user?.email ?? null,
    row: (data as ConnexionRow | null) ?? null,
  };
});

function estActive(row: ConnexionRow | null): row is ConnexionRow {
  return Boolean(row && row.etat === 'actif');
}

/** Semaine en cours : ce que voit l'accueil au premier rendu. */
export async function lireAgendaSemaine(): Promise<AgendaReponse> {
  return lireAgendaPlage(cleAgenda('semaine', dateKeyParis(new Date())));
}

/** Une plage précise (« semaine:2026-09-07 », « mois:2026-09 »). */
export async function lireAgendaPlage(cle: string): Promise<AgendaReponse> {
  if (!cleValide(cle)) {
    return { connected: false, events: [] };
  }

  const { admin, userEmail, row } = await chargerConnexion();
  if (!estActive(row)) {
    return { connected: false, cle, events: [] };
  }

  const { timeMin, timeMax } = bornesDeCle(cle);
  let events: AgendaEvenement[] = [];
  try {
    const accessToken = await accessTokenAgenda({ admin, row });
    events = await fetchCalendarEvents({
      accessToken,
      timeMin,
      timeMax,
    });
  } catch (err) {
    console.error('[calendar events]', err);
  }

  return {
    connected: true,
    calendarEmail: row.calendar_email ?? userEmail,
    cle,
    events,
  };
}
