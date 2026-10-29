import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { estEnAttente } from '@/lib/billing/acces';
import { lireAnnonces, lireEvenements } from '@/lib/annonces/lire';
import { baisseCumulee } from '@/lib/annonces/presenter';
import {
  FENETRE_FLASH_JOURS,
  flashDesAnnonces,
  flashDesDpe,
  ordreDuBandeau,
  type FlashItem,
  type LieuAJuger,
} from '@/lib/carte/flash';
import { chargerDpeRecents } from '@/lib/queries/tournee';
import { fetchZonesSafe } from '@/lib/queries/zones';
import { dateKeyParis } from '@/lib/today/calendar';
import { adresseAJuger } from '@/lib/zones/adresse';
import { zoneDeLAdresse } from '@/lib/zones/appartenance';
import { codesDuSecteur } from '@/lib/zones/codes-postaux';
import { bboxDeZone, fusionnerBbox, type Bbox } from '@/lib/zones/geometrie';

export const runtime = 'nodejs';
export const maxDuration = 20;

/**
 * Le flash de la carte : nouveaux DPE, annonces en baisse et nouvelles
 * annonces du périmètre affiché. `zones` : les secteurs peints sur la carte ;
 * `cp=1` : tout le code postal de l'agence.
 */
export async function GET(req: Request) {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }
  if (estEnAttente(agency)) return NextResponse.json({ items: [] });

  const params = new URL(req.url).searchParams;
  const toutLeCodePostal = params.get('cp') === '1';
  const demandees = new Set((params.get('zones') ?? '').split(',').filter(Boolean).slice(0, 50));

  const supabase = await createSupabaseServerClient();
  const zones = (await fetchZonesSafe(supabase)).filter((z) => z.actif);
  const cadrees = toutLeCodePostal ? [] : zones.filter((z) => demandees.has(z.id));
  const idsCadres = new Set(cadrees.map((z) => z.id));
  const codesAgence = (agency.codes_postaux ?? []).filter((c) => /^\d{5}$/.test(c));

  // Le vrai titulaire de l'adresse, parmi tous les secteurs : une parcelle d'un collègue
  // dans le rectangle de mon secteur n'est pas à moi.
  const dansLePerimetre = (lieu: LieuAJuger): boolean => {
    if (cadrees.length === 0) {
      return !lieu.codePostal || codesAgence.length === 0 || codesAgence.includes(lieu.codePostal);
    }
    const zone = zoneDeLAdresse(
      adresseAJuger({
        address: lieu.adresse,
        postalCode: lieu.codePostal,
        latitude: lieu.latitude,
        longitude: lieu.longitude,
        parcelleId: lieu.parcelleId,
      }),
      zones,
    );
    return zone !== null && idsCadres.has(zone.id);
  };

  const maintenant = new Date();
  const codes =
    cadrees.length > 0
      ? [...new Set(cadrees.flatMap((z) => codesDuSecteur(z, codesAgence)))]
      : codesAgence;
  const boite = fusionnerBbox(cadrees.map(bboxDeZone).filter((b): b is Bbox => b !== null));

  const [dpes, annonces] = await Promise.all([
    chargerDpeRecents({
      openData: createSupabaseAdminClient(),
      codesPostaux: codes,
      depuis: dateKeyParis(new Date(maintenant.getTime() - FENETRE_FLASH_JOURS * 86_400_000)),
      zone: boite,
      voisinage: null,
    }).catch((err: unknown) => {
      console.error('[flash] DPE', err instanceof Error ? err.message : err);
      return [];
    }),
    lireAnnonces(supabase),
  ]);
  // Les événements de prix ne se lisent que pour les annonces déjà en baisse.
  const enBaisse = annonces.filter((a) => a.statut === 'active' && baisseCumulee(a) != null).map((a) => a.id);
  const evenements = await lireEvenements(supabase, enBaisse);

  const ctx = { dansLePerimetre, maintenant };
  const items: FlashItem[] = ordreDuBandeau([
    ...flashDesDpe(dpes, ctx),
    // La liste reste légère : les raisons de localisation arrivent avec le détail.
    ...flashDesAnnonces(annonces, evenements, ctx).map((i) => ({
      ...i,
      annonce: { ...i.annonce, raisonsLocalisation: [] },
    })),
  ]);

  return NextResponse.json({ items }, { headers: { 'Cache-Control': 'private, max-age=300' } });
}
