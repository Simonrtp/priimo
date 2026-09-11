import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { canEditZone, viewerFromProfile } from '@/lib/agency/visibility';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { fetchZonePourDroit } from '@/lib/queries/zones';
import { signalerChevauchementsSiBesoin } from '@/lib/queries/zone-conflits';
import { estInvalide, validerTypeRegle, validerValeurRegle } from '@/lib/zones/valider';

export const runtime = 'nodejs';

async function autoriser(zoneId: string) {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return { erreur: NextResponse.json({ error: 'Non authentifié' }, { status: 401 }) };
  }
  const supabase = await createSupabaseServerClient();
  const zoneDroit = await fetchZonePourDroit(supabase, { zoneId, agencyId: agency.id });

  if (!zoneDroit) {
    return { erreur: NextResponse.json({ error: 'Secteur introuvable' }, { status: 404 }) };
  }
  if (!canEditZone(viewerFromProfile(profile), zoneDroit)) {
    return {
      erreur: NextResponse.json(
        {
          error: zoneDroit.verrouillee
            ? 'Secteur défini par la direction'
            : 'Vous ne pouvez modifier que votre secteur',
        },
        { status: 403 },
      ),
    };
  }
  return { supabase, profile, agency };
}

/**
 * Déplacer un sommet après validation : un secteur se corrige, il ne se
 * redessine pas. Seule la valeur change, la règle garde son identité.
 */
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ zoneId: string; regleId: string }> },
) {
  const { zoneId, regleId } = await ctx.params;
  const acces = await autoriser(zoneId);
  if ('erreur' in acces) return acces.erreur;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
  }
  const raw = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};

  const type = validerTypeRegle(raw.type);
  if (estInvalide(type)) return NextResponse.json({ error: type.erreur }, { status: 400 });

  const valeur = validerValeurRegle(type.valeur, raw.valeur);
  if (estInvalide(valeur)) return NextResponse.json({ error: valeur.erreur }, { status: 400 });

  const { error } = await acces.supabase
    .from('zone_regles')
    .update({ valeur: valeur.valeur })
    .eq('id', regleId)
    .eq('zone_id', zoneId);

  if (error) {
    console.error('[zones] règle non mise à jour', error);
    return NextResponse.json({ error: 'La règle n’a pas pu être modifiée' }, { status: 400 });
  }

  if (type.valeur === 'polygone') {
    await signalerChevauchementsSiBesoin({
      supabase: acces.supabase,
      agencyId: acces.agency.id,
      createdBy: acces.profile.id,
      zoneId,
    });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ zoneId: string; regleId: string }> },
) {
  const { zoneId, regleId } = await ctx.params;
  const acces = await autoriser(zoneId);
  if ('erreur' in acces) return acces.erreur;

  const { error } = await acces.supabase
    .from('zone_regles')
    .delete()
    .eq('id', regleId)
    .eq('zone_id', zoneId);

  if (error) {
    console.error('[zones] règle non supprimée', error);
    return NextResponse.json({ error: 'La règle n’a pas pu être supprimée' }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
