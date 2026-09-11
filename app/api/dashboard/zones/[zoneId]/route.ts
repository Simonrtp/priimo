import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import {
  canDeleteZone,
  canEditZone,
  canManageZone,
  viewerFromProfile,
} from '@/lib/agency/visibility';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { fetchMembersOfMyAgency, memberIdSet } from '@/lib/queries/agency-members';
import { fetchZonePourDroit, joursEnConflit } from '@/lib/queries/zones';
import type { ZoneInsert } from '@/types/database';
import { libelleJours } from '@/lib/zones/jour';
import {
  estInvalide,
  validerCouleurZone,
  validerJoursSemaine,
  validerNomZone,
} from '@/lib/zones/valider';

export const runtime = 'nodejs';

/**
 * Le titulaire retouche le nom, la couleur, le jour — tant que ce n'est pas
 * verrouillé. Réattribuer, verrouiller, éteindre : direction seulement.
 *
 * On ne supprime pas une zone dont on veut garder l'historique : `actif` à
 * false suffit, et l'appartenance des leads déjà pris ne bouge pas — elle
 * n'était de toute façon jamais stockée.
 */
export async function PATCH(req: Request, ctx: { params: Promise<{ zoneId: string }> }) {
  const { user, profile, agency, memberships } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const { zoneId } = await ctx.params;
  if (!zoneId) return NextResponse.json({ error: 'Secteur inconnu' }, { status: 400 });

  const supabase = await createSupabaseServerClient();
  const zoneDroit = await fetchZonePourDroit(supabase, { zoneId, agencyId: agency.id });

  if (!zoneDroit) return NextResponse.json({ error: 'Secteur introuvable' }, { status: 404 });

  const viewer = viewerFromProfile(profile);
  if (!canEditZone(viewer, zoneDroit)) {
    return NextResponse.json(
      {
        error: zoneDroit.verrouillee
          ? 'Secteur défini par la direction'
          : 'Vous ne pouvez modifier que votre secteur',
      },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
  }
  const raw = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};

  const update: Partial<ZoneInsert> = {};

  if (raw.nom !== undefined) {
    const verdict = validerNomZone(raw.nom);
    if (estInvalide(verdict)) return NextResponse.json({ error: verdict.erreur }, { status: 400 });
    update.nom = verdict.valeur;
  }
  if (raw.couleur !== undefined) {
    const verdict = validerCouleurZone(raw.couleur);
    if (estInvalide(verdict)) return NextResponse.json({ error: verdict.erreur }, { status: 400 });
    update.couleur = verdict.valeur;
  }
  if (raw.joursSemaine !== undefined) {
    const verdict = validerJoursSemaine(raw.joursSemaine);
    if (estInvalide(verdict)) return NextResponse.json({ error: verdict.erreur }, { status: 400 });

    // Le titulaire qui compte est celui d'après la requête : réattribuer et
    // recaler les jours dans le même geste doit rester possible.
    const titulaire =
      raw.assignedTo === undefined
        ? zoneDroit.assignedTo
        : typeof raw.assignedTo === 'string' && raw.assignedTo !== ''
          ? raw.assignedTo
          : null;
    const conflits = await joursEnConflit(supabase, {
      agencyId: agency.id,
      assignedTo: titulaire,
      jours: verdict.valeur,
      saufZoneId: zoneId,
    });
    if (conflits.length > 0) {
      return NextResponse.json(
        { error: `Un autre secteur occupe déjà ${libelleJours(conflits)?.toLowerCase()}` },
        { status: 409 },
      );
    }
    update.jours_semaine = verdict.valeur;
  }
  if (raw.actif !== undefined || raw.assignedTo !== undefined || raw.verrouillee !== undefined) {
    if (!canManageZone(viewer)) {
      return NextResponse.json(
        { error: 'Seul le directeur peut réattribuer ou verrouiller un secteur' },
        { status: 403 },
      );
    }
  }

  if (raw.verrouillee !== undefined) {
    if (typeof raw.verrouillee !== 'boolean') {
      return NextResponse.json({ error: 'Verrouillage invalide' }, { status: 400 });
    }
    update.verrouillee = raw.verrouillee;
  }
  if (raw.actif !== undefined) {
    if (typeof raw.actif !== 'boolean') {
      return NextResponse.json({ error: 'État de secteur invalide' }, { status: 400 });
    }
    update.actif = raw.actif;
  }
  if (raw.assignedTo !== undefined) {
    if (raw.assignedTo === null || raw.assignedTo === '') {
      update.assigned_to = null;
    } else if (typeof raw.assignedTo !== 'string') {
      return NextResponse.json({ error: 'Titulaire invalide' }, { status: 400 });
    } else {
      const members = await fetchMembersOfMyAgency(agency.id, memberships);
      if (!memberIdSet(members).has(raw.assignedTo)) {
        return NextResponse.json(
          { error: "Cette personne n'appartient pas à l'agence" },
          { status: 400 },
        );
      }
      update.assigned_to = raw.assignedTo;
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Rien à modifier' }, { status: 400 });
  }

  const { error } = await supabase
    .from('zones')
    .update(update)
    .eq('id', zoneId)
    .eq('agency_id', agency.id);

  if (error) {
    console.error('[zones] modification impossible', error);
    // Le seul index unique en jeu : un titulaire, un jour, une zone.
    const conflit = error.code === '23505';
    return NextResponse.json(
      {
        error: conflit
          ? 'Ce négociateur a déjà un secteur ce jour-là'
          : 'Le secteur n’a pas pu être modifié',
      },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ zoneId: string }> }) {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const { zoneId } = await ctx.params;
  if (!zoneId) return NextResponse.json({ error: 'Secteur inconnu' }, { status: 400 });

  const supabase = await createSupabaseServerClient();
  const zone = await fetchZonePourDroit(supabase, { zoneId, agencyId: agency.id });
  if (!zone) return NextResponse.json({ error: 'Secteur introuvable' }, { status: 404 });

  if (!canDeleteZone(viewerFromProfile(profile), zone)) {
    return NextResponse.json(
      {
        error: zone.verrouillee
          ? 'Secteur défini par la direction'
          : 'Vous ne pouvez supprimer que votre secteur',
      },
      { status: 403 },
    );
  }

  const { error } = await supabase
    .from('zones')
    .delete()
    .eq('id', zoneId)
    .eq('agency_id', agency.id);

  if (error) {
    console.error('[zones] suppression impossible', error);
    return NextResponse.json({ error: 'Le secteur n’a pas pu être supprimé' }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
