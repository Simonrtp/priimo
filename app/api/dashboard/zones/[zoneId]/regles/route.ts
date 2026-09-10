import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { canEditZone, viewerFromProfile } from '@/lib/agency/visibility';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { signalerChevauchementsSiBesoin } from '@/lib/queries/zone-conflits';
import { estInvalide, validerTypeRegle, validerValeurRegle } from '@/lib/zones/valider';

export const runtime = 'nodejs';

/**
 * Ajout d'une règle à un secteur. Le directeur dessine partout, le titulaire
 * corrige le sien tant que la direction n'a pas verrouillé.
 *
 * Une règle s'ajoute, elle ne remplace pas. Un secteur se construit par
 * ajouts et retraits successifs, et chaque règle reste supprimable seule.
 */
export async function POST(req: Request, ctx: { params: Promise<{ zoneId: string }> }) {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const { zoneId } = await ctx.params;
  if (!zoneId) return NextResponse.json({ error: 'Secteur inconnu' }, { status: 400 });

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

  const inclusion = raw.inclusion === undefined ? true : raw.inclusion === true;

  const supabase = await createSupabaseServerClient();
  const { data: zone } = await supabase
    .from('zones')
    .select('id, assigned_to, verrouillee')
    .eq('id', zoneId)
    .eq('agency_id', agency.id)
    .maybeSingle();

  if (!zone) return NextResponse.json({ error: 'Secteur introuvable' }, { status: 404 });

  const zoneDroit = {
    assignedTo: zone.assigned_to,
    verrouillee: zone.verrouillee === true,
  };
  if (!canEditZone(viewerFromProfile(profile), zoneDroit)) {
    return NextResponse.json(
      {
        error: zoneDroit.verrouillee
          ? 'Secteur défini par la direction'
          : 'Vous ne pouvez modifier que votre secteur',
      },
      { status: 403 },
    );
  }

  const { data, error } = await supabase
    .from('zone_regles')
    .insert({ zone_id: zoneId, type: type.valeur, valeur: valeur.valeur, inclusion })
    .select('id')
    .single();

  if (error || !data) {
    console.error('[zones] règle non enregistrée', error);
    return NextResponse.json({ error: 'La règle n’a pas pu être enregistrée' }, { status: 400 });
  }

  if (type.valeur === 'polygone') {
    await signalerChevauchementsSiBesoin({
      supabase,
      agencyId: agency.id,
      createdBy: profile.id,
      zoneId,
    });
  }

  return NextResponse.json({ id: data.id }, { status: 201 });
}
