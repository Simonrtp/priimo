import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { viewerFromProfile } from '@/lib/agency/visibility';
import { visibleLeadsFor } from '@/lib/agency/scope-records';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { fetchLeads } from '@/lib/queries/leads';
import { fetchLeadStages } from '@/lib/queries/lead-stages';
import { fetchPassagesObserves } from '@/lib/queries/passages';
import { fetchZonesSafe } from '@/lib/queries/zones';
import { fetchParcDuSecteur } from '@/lib/queries/secteur-parc';
import { bbox, fusionnerBbox, polygonesDeZone } from '@/lib/zones/geometrie';
import { statistiquesSecteur } from '@/lib/zones/statistiques';
import type { Zone } from '@/lib/zones/types';

export const runtime = 'nodejs';

/**
 * Ce qu'on sait d'un secteur une fois tracé : combien d'immeubles, combien de
 * rues, et sur quelle part Priimo a déjà observé un passage.
 *
 * Le calcul est à la demande plutôt que dans la page d'accueil : il croise le
 * parc open data avec treize semaines de journal, et l'accueil doit s'afficher
 * en un temps que personne ne remarque.
 */

/** Les codes postaux qu'un secteur revendique explicitement dans ses règles. */
function codesPostauxDesRegles(zone: Zone): string[] {
  const codes = new Set<string>();
  for (const regle of zone.regles) {
    if (!regle.inclusion) continue;
    if (regle.type === 'code_postal') codes.add(regle.valeur.code_postal);
    if (regle.type === 'voie') codes.add(regle.valeur.code_postal);
  }
  return [...codes];
}

export async function GET(_req: Request, ctx: { params: Promise<{ zoneId: string }> }) {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const { zoneId } = await ctx.params;
  if (!zoneId) return NextResponse.json({ error: 'Secteur inconnu' }, { status: 400 });

  const supabase = await createSupabaseServerClient();
  const zones = await fetchZonesSafe(supabase);
  const zone = zones.find((z) => z.id === zoneId);
  if (!zone) return NextResponse.json({ error: 'Secteur introuvable' }, { status: 404 });

  const cadre = fusionnerBbox(
    polygonesDeZone(zone)
      .map(bbox)
      .filter((b): b is NonNullable<typeof b> => b !== null),
  );

  // Le territoire de l'agence borne toujours la recherche. Les codes postaux
  // des règles s'y ajoutent : une agence peut tenir un secteur sur une commune
  // limitrophe sans l'avoir déclarée en territoire de livraison.
  const codesPostaux = [
    ...new Set([...(agency.codes_postaux ?? []), ...codesPostauxDesRegles(zone)]),
  ];

  try {
    const [parc, leads, stages] = await Promise.all([
      fetchParcDuSecteur({ supabase, codesPostaux, cadre }),
      fetchLeads(supabase),
      fetchLeadStages(supabase),
    ]);
    const passages = await fetchPassagesObserves({ supabase, stages });

    const stats = statistiquesSecteur({
      zone,
      parc: parc.immeubles,
      passages: new Set(passages.map((p) => p.banId)),
      leads: visibleLeadsFor(viewerFromProfile(profile), leads),
    });

    return NextResponse.json({ ...stats, tronque: parc.tronque });
  } catch (err) {
    console.error('[secteur] statistiques impossibles', err);
    return NextResponse.json({ error: 'Statistiques indisponibles' }, { status: 500 });
  }
}
