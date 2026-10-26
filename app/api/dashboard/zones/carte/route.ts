import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getServerUser } from '@/lib/auth/getServerUser';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { fetchMembersOfMyAgency } from '@/lib/queries/agency-members';
import { fetchZones } from '@/lib/queries/zones';
import { COULEUR_SANS_TITULAIRE, initialesMembre } from '@/lib/zones/couleurs-membres';
import { assurerCouleursMembres } from '@/lib/zones/couleurs-membres-serveur';
import { lireGeometries } from '@/lib/zones/parcelles-serveur';

export const runtime = 'nodejs';

/**
 * Les parcelles de tous les secteurs de l'agence, prêtes à dessiner : une
 * entité GeoJSON par parcelle, avec le secteur, la couleur et les initiales
 * de son titulaire. La carte filtre ensuite (mes secteurs, l'agence, le
 * secteur en cours de création).
 */
export async function GET() {
  const { user, profile, agency, memberships } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }
  const supabase = await createSupabaseServerClient();
  try {
    const [zones, membres] = await Promise.all([
      fetchZones(supabase),
      fetchMembersOfMyAgency(agency.id, memberships),
    ]);
    const actives = zones.filter((z) => z.actif);
    const titulaires = [...new Set(actives.map((z) => z.assignedTo).filter((id): id is string => !!id))];
    const couleurs = await assurerCouleursMembres(
      createSupabaseAdminClient() as unknown as SupabaseClient,
      agency.id,
      titulaires,
    );
    const parId = new Map(membres.map((m) => [m.id, m]));

    const idsParZone = actives.map((z) => ({
      zone: z,
      ids: z.regles.flatMap((r) => (r.type === 'parcelles' && r.inclusion ? r.valeur.parcelle_ids : [])),
    }));
    const geometries = await lireGeometries(
      supabase as unknown as SupabaseClient,
      [...new Set(idsParZone.flatMap((x) => x.ids))],
    );
    const geoParId = new Map(geometries.map((g) => [g.id, g]));

    const features: GeoJSON.Feature<GeoJSON.Polygon>[] = [];
    const secteurs = idsParZone.map(({ zone, ids }) => {
      const membre = zone.assignedTo ? parId.get(zone.assignedTo) : undefined;
      const couleur = (zone.assignedTo && couleurs.get(zone.assignedTo)) || COULEUR_SANS_TITULAIRE;
      const initiales = membre ? initialesMembre(membre.firstName, membre.lastName) : '';
      for (const id of ids) {
        const g = geoParId.get(id);
        if (!g) continue;
        features.push({
          type: 'Feature',
          id,
          properties: { parcelleId: id, zoneId: zone.id, assignedTo: zone.assignedTo, couleur, initiales },
          geometry: { type: 'Polygon', coordinates: g.anneaux },
        });
      }
      return { zoneId: zone.id, assignedTo: zone.assignedTo, couleur, initiales, parcelles: ids.length };
    });

    return NextResponse.json({ type: 'FeatureCollection', features, secteurs });
  } catch (e) {
    console.error('[zones] carte des secteurs', e instanceof Error ? e.message : e);
    return NextResponse.json({ type: 'FeatureCollection', features: [], secteurs: [] });
  }
}
