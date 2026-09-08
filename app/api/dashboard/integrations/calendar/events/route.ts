import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { accessTokenAgenda, fetchCalendarEvents } from '@/lib/agenda/google-calendar';
import { bornesIsoSemaine } from '@/lib/agenda/semaine';
import { dateKeyParis } from '@/lib/today/calendar';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

export async function GET() {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  const { data: row } = await admin
    .from('calendar_connexions')
    .select('id, calendar_email, etat, token_ciphertext, token_nonce, dernier_erreur')
    .eq('agency_id', agency.id)
    .eq('profile_id', profile.id)
    .maybeSingle();

  const maintenant = new Date();
  const { timeMin, timeMax } = bornesIsoSemaine(maintenant);

  if (!row || row.etat === 'revoke') {
    return NextResponse.json({
      connected: false,
      emailPro: user.email,
      debut: dateKeyParis(new Date(timeMin)),
      fin: dateKeyParis(new Date(new Date(timeMax).getTime() - 1)),
      events: [],
    });
  }

  try {
    const accessToken = await accessTokenAgenda({ admin, row });
    const events = await fetchCalendarEvents({ accessToken, timeMin, timeMax });
    return NextResponse.json({
      connected: true,
      calendarEmail: row.calendar_email,
      emailPro: user.email,
      debut: dateKeyParis(new Date(timeMin)),
      fin: dateKeyParis(new Date(new Date(timeMax).getTime() - 1)),
      events,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'lecture impossible';
    await admin
      .from('calendar_connexions')
      .update({ etat: 'erreur', dernier_erreur: message.slice(0, 500) })
      .eq('id', row.id);
    return NextResponse.json(
      {
        connected: false,
        emailPro: user.email,
        calendarEmail: row.calendar_email,
        error: message,
        events: [],
      },
      { status: 502 },
    );
  }
}
