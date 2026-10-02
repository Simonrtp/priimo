import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { creerContact } from '@/lib/contacts/creation';

export const runtime = 'nodejs';

/** Création d'un contact : saisie manuelle ou dictée validée par l'agent. */
export async function POST(req: Request) {
  const { user, profile, agency, memberships } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
  }

  const resultat = await creerContact(
    { supabase: await createSupabaseServerClient(), profile, agencyId: agency.id, memberships },
    body,
  );

  if (!resultat.ok) {
    const { status, ...corps } = resultat;
    return NextResponse.json(
      { error: corps.error, field: corps.field ?? null, ...(corps.matches ? { matches: corps.matches } : {}) },
      { status },
    );
  }
  return NextResponse.json(
    resultat.reused ? { contact: resultat.contact, reused: true } : { contact: resultat.contact },
    { status: resultat.status },
  );
}
