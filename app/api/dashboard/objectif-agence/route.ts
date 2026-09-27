import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { enregistrerObjectifAgence } from '@/lib/queries/activite';
import { OBJECTIF_MAX } from '@/lib/activite/objectifs';

export const runtime = 'nodejs';

/**
 * Pose l'objectif mensuel de mandats de l'agence (Accueil directeur).
 * Réservé au directeur de l'agence active.
 */
export async function PUT(req: Request) {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
  }
  if (profile.role !== 'directeur') {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
  }

  let corps: unknown;
  try {
    corps = await req.json();
  } catch {
    return NextResponse.json({ error: 'Requête illisible' }, { status: 400 });
  }

  const brut = (corps as { objectifMandatsMois?: unknown }).objectifMandatsMois;
  const n = typeof brut === 'number' ? brut : Number.NaN;
  if (!Number.isInteger(n) || n < 0 || n > OBJECTIF_MAX) {
    return NextResponse.json(
      { error: 'Un objectif doit être un nombre entier entre 0 et 10 000.' },
      { status: 400 },
    );
  }

  const supabase = await createSupabaseServerClient();
  const resultat = await enregistrerObjectifAgence({
    supabase,
    agencyId: agency.id,
    updatedBy: profile.id,
    objectifMandatsMois: n,
  });

  if (!resultat.ok) {
    return NextResponse.json(
      { error: "L'objectif d'agence n'a pas pu être enregistré." },
      { status: 500 },
    );
  }

  return NextResponse.json({ objectifMandatsMois: n });
}
