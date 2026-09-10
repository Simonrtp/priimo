import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { canCreateZone, viewerFromProfile } from '@/lib/agency/visibility';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { fetchZones } from '@/lib/queries/zones';
import { couleurZoneLibre } from '@/lib/zones/palette';
import {
  estInvalide,
  validerCouleurZone,
  validerJourSemaine,
  validerNomZone,
} from '@/lib/zones/valider';

export const runtime = 'nodejs';

/**
 * Les zones de l'agence. La RLS fait la loi : lecture ouverte à toute
 * l'agence, création par le titulaire (la sienne) ou le directeur.
 * Les vérifications ici rendent l'erreur lisible, elles ne remplacent pas
 * les policies.
 */
export async function GET() {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const supabase = await createSupabaseServerClient();
  try {
    return NextResponse.json({ zones: await fetchZones(supabase) });
  } catch (err) {
    console.error('[zones] lecture impossible', err);
    return NextResponse.json({ error: 'Lecture des secteurs impossible' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
  }
  const raw = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};

  const nom = validerNomZone(raw.nom);
  if (estInvalide(nom)) return NextResponse.json({ error: nom.erreur }, { status: 400 });

  const jour = validerJourSemaine(raw.jourSemaine ?? null);
  if (estInvalide(jour)) return NextResponse.json({ error: jour.erreur }, { status: 400 });

  const supabase = await createSupabaseServerClient();

  let couleur: string;
  if (raw.couleur === undefined || raw.couleur === null) {
    const { data } = await supabase.from('zones').select('couleur');
    couleur = couleurZoneLibre((data ?? []).map((z) => z.couleur));
  } else {
    const verdict = validerCouleurZone(raw.couleur);
    if (estInvalide(verdict)) return NextResponse.json({ error: verdict.erreur }, { status: 400 });
    couleur = verdict.valeur;
  }

  const viewer = viewerFromProfile(profile);
  const assignedTo =
    viewer.role === 'directeur'
      ? typeof raw.assignedTo === 'string' && raw.assignedTo !== ''
        ? raw.assignedTo
        : null
      : profile.id;

  if (!canCreateZone(viewer, assignedTo)) {
    return NextResponse.json(
      { error: 'Vous ne pouvez créer que votre secteur' },
      { status: 403 },
    );
  }

  const { data, error } = await supabase
    .from('zones')
    .insert({
      agency_id: agency.id,
      nom: nom.valeur,
      couleur,
      assigned_to: assignedTo,
      jour_semaine: jour.valeur,
    })
    .select('id')
    .single();

  if (error || !data) {
    console.error('[zones] création impossible', error);
    return NextResponse.json({ error: 'Le secteur n’a pas pu être créé' }, { status: 400 });
  }

  return NextResponse.json({ id: data.id }, { status: 201 });
}
