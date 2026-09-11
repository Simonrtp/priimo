import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { Bbox } from '@/lib/zones/geometrie';
import type { ImmeubleParc } from '@/lib/zones/statistiques';

type Client = SupabaseClient<Database>;

/**
 * Le parc d'immeubles d'un secteur.
 *
 * `buildings` est de l'open data géolocalisé, lisible par tout compte
 * authentifié. On le borne quand même au territoire de l'agence et à l'emprise
 * du contour : sans ces deux filtres, un secteur parisien ramènerait la France.
 */

/**
 * Au-delà, ce n'est plus un secteur de négociateur mais une région, et le
 * chiffre affiché serait tronqué sans le dire. On préfère le signaler.
 */
export const PLAFOND_PARC = 8000;

export type ParcDuSecteur = {
  immeubles: ImmeubleParc[];
  /** Vrai quand le plafond a été atteint : les chiffres sont alors un plancher. */
  tronque: boolean;
};

export async function fetchParcDuSecteur(params: {
  supabase: Client;
  codesPostaux: readonly string[];
  cadre: Bbox | null;
}): Promise<ParcDuSecteur> {
  const codes = params.codesPostaux.filter((c) => /^\d{5}$/.test(c));
  if (codes.length === 0) return { immeubles: [], tronque: false };

  let requete = params.supabase
    .from('buildings')
    .select('ban_id, adresse, code_postal, lat, lng')
    .in('code_postal', codes)
    .not('lat', 'is', null)
    .not('lng', 'is', null)
    .limit(PLAFOND_PARC);

  // Un secteur qui n'est fait que de règles de voie ou de code postal n'a pas
  // d'emprise : on se contente alors du territoire de l'agence.
  if (params.cadre) {
    requete = requete
      .gte('lat', params.cadre.sud)
      .lte('lat', params.cadre.nord)
      .gte('lng', params.cadre.ouest)
      .lte('lng', params.cadre.est);
  }

  const { data, error } = await requete;
  if (error) {
    console.error('[secteur] parc illisible', error.message);
    return { immeubles: [], tronque: false };
  }

  const rows = (data ?? []) as unknown as {
    ban_id: string;
    adresse: string | null;
    code_postal: string | null;
    lat: number | null;
    lng: number | null;
  }[];

  return {
    immeubles: rows.map((row) => ({
      banId: row.ban_id,
      adresse: row.adresse,
      codePostal: row.code_postal,
      latitude: row.lat,
      longitude: row.lng,
    })),
    tronque: rows.length >= PLAFOND_PARC,
  };
}
