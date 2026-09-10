import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { canSeeActivityOf, viewerFromProfile } from '@/lib/agency/visibility';
import { fetchMembersOfMyAgency } from '@/lib/queries/agency-members';
import { enregistrerObjectifs } from '@/lib/queries/activite';
import { lignesObjectifs, parseObjectifsSaisis } from '@/lib/activite/objectifs';

export const runtime = 'nodejs';

/**
 * Poser les objectifs d'un collaborateur.
 *
 * Écriture seulement : la lecture voyage déjà avec le bilan de l'Accueil
 * (`bilan.objectifsPoses`), et une route de lecture ferait attendre l'agent
 * devant des chiffres qu'il a sous les yeux.
 *
 * Chacun règle les siens ; un directeur règle ceux de son agence. C'est la même
 * frontière que pour les chiffres — `canSeeActivityOf` — et la RLS la rejoue
 * derrière : cette route ne fait pas autorité, elle rend juste l'erreur lisible.
 */

/** À qui appartiennent les objectifs visés, ou `null` si l'appelant n'y a pas droit. */
async function cible(demande: string | null) {
  const { user, profile, agency, memberships } = await getServerUser();
  if (!user || !profile || !agency) return null;

  const viewer = viewerFromProfile(profile);
  const profileId = demande && demande !== profile.id ? demande : profile.id;
  if (!canSeeActivityOf(viewer, profileId)) return null;

  // Un directeur voit « tout le monde » au sens de la visibilité : la limite à
  // sa propre agence, elle, se vérifie ici.
  if (profileId !== profile.id) {
    const members = await fetchMembersOfMyAgency(agency.id, memberships);
    if (!members.some((m) => m.id === profileId)) return null;
  }

  return { agencyId: agency.id, profileId, auteurId: profile.id };
}

export async function PUT(req: Request) {
  let corps: unknown;
  try {
    corps = await req.json();
  } catch {
    return NextResponse.json({ error: 'Requête illisible' }, { status: 400 });
  }

  const membre = (corps as { membre?: unknown }).membre;
  const vise = await cible(typeof membre === 'string' ? membre : null);
  if (!vise) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });

  const saisie = parseObjectifsSaisis(corps);
  if (!saisie) {
    return NextResponse.json(
      { error: 'Un objectif doit être un nombre entier entre 0 et 10 000.' },
      { status: 400 },
    );
  }

  const supabase = await createSupabaseServerClient();
  const resultat = await enregistrerObjectifs({
    supabase,
    agencyId: vise.agencyId,
    profileId: vise.profileId,
    updatedBy: vise.auteurId,
    lignes: lignesObjectifs(saisie),
  });

  if (!resultat.ok) {
    return NextResponse.json(
      { error: "Les objectifs n'ont pas pu être enregistrés." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ...saisie, parDefaut: false });
}
