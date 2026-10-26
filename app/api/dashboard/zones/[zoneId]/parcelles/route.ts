import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getServerUser } from '@/lib/auth/getServerUser';
import { canEditZone, viewerFromProfile } from '@/lib/agency/visibility';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { fetchZonePourDroit } from '@/lib/queries/zones';
import {
  PARCELLES_MAX_PAR_TRACE,
  ecrireParcelles,
  idsPropres,
  parcellesDeLaRue,
  parcellesDuSecteur,
  parcellesDuTrace,
} from '@/lib/zones/parcelles-serveur';
import { estInvalide, validerValeurRegle } from '@/lib/zones/valider';
import type { PariteVoie, ValeurPolygone } from '@/lib/zones/types';

export const runtime = 'nodejs';

/**
 * Les parcelles d'un secteur : en ajouter (une à une, par un tracé, par un
 * côté de rue), en retirer. Une parcelle déjà tenue par un collègue est
 * refusée ; le directeur peut la reprendre (`reprendre`).
 *
 * Réponse : ce qui a été ajouté, retiré, refusé, et la liste complète.
 */
export async function POST(req: Request, ctx: { params: Promise<{ zoneId: string }> }) {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }
  const { zoneId } = await ctx.params;
  if (!zoneId) return NextResponse.json({ error: 'Secteur inconnu' }, { status: 400 });

  let body: Record<string, unknown>;
  try {
    const brut = (await req.json()) as unknown;
    body = typeof brut === 'object' && brut !== null ? (brut as Record<string, unknown>) : {};
  } catch {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
  }

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

  const client = supabase as unknown as SupabaseClient;
  const ajouter = new Set(idsPropres(body.ajouter));
  const retirer = new Set(idsPropres(body.retirer));
  const modeTrace = body.mode === 'retirer' ? retirer : ajouter;

  try {
    if (body.trace !== undefined) {
      const trace = validerValeurRegle('polygone', body.trace);
      if (estInvalide(trace)) return NextResponse.json({ error: trace.erreur }, { status: 400 });
      for (const id of await parcellesDuTrace(client, trace.valeur as ValeurPolygone)) modeTrace.add(id);
    }
    const rue = body.rue as { nom?: unknown; codePostal?: unknown; parite?: unknown; id?: unknown } | undefined;
    if (rue && typeof rue.nom === 'string' && typeof rue.codePostal === 'string') {
      const parite: PariteVoie =
        rue.parite === 'paires' || rue.parite === 'impaires' ? rue.parite : 'toutes';
      for (const id of await parcellesDeLaRue(
        { nom: rue.nom, codePostal: rue.codePostal, id: typeof rue.id === 'string' ? rue.id : undefined },
        parite,
        createSupabaseAdminClient() as unknown as SupabaseClient,
      )) {
        modeTrace.add(id);
      }
    }
    if (ajouter.size + retirer.size > PARCELLES_MAX_PAR_TRACE) {
      return NextResponse.json(
        { error: 'Trop de parcelles d’un coup : tracez une partie plus petite' },
        { status: 400 },
      );
    }

    const resultat = await ecrireParcelles(client, {
      zoneId,
      agencyId: agency.id,
      ajouter: [...ajouter],
      retirer: [...retirer],
      reprendre: body.reprendre === true && viewer.role === 'directeur',
    });
    const parcelleIds = await parcellesDuSecteur(client, zoneId);
    return NextResponse.json({ ...resultat, parcelleIds });
  } catch (e) {
    console.error('[zones] parcelles', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Les parcelles n’ont pas pu être enregistrées' }, { status: 500 });
  }
}
