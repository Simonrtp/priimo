import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getServerUser } from '@/lib/auth/getServerUser';
import { lireAnnonce, lireEvenements } from '@/lib/annonces/lire';
import { extrairePhotosPap, photosPubliques } from '@/lib/annonces/photos';
import { telechargerPage } from '@/lib/annonces/import/telecharger';
import { ligneHistorique } from '@/lib/annonces/presenter';
import type { Annonce } from '@/lib/annonces/types';

export const runtime = 'nodejs';
export const maxDuration = 120;

async function garderPhotos(id: string, photos: string[]) {
  const admin = createSupabaseAdminClient();
  const { error } = await (admin as unknown as SupabaseClient).from('annonces').update({ photos }).eq('id', id);
  if (error) console.error('[annonces] photos', error.message);
}

/** Photos déjà gardées, sinon la page publique. `relire` : PAP passe par le lecteur déjà utilisé à l’import. */
async function photosDeLAnnonce(annonce: Annonce, relire: boolean): Promise<string[]> {
  const deja = annonce.photos ?? [];
  if (deja.length > 0) return deja;
  if (!relire) {
    const publiques = await photosPubliques(annonce.portail, annonce.url);
    if (publiques.length > 0) await garderPhotos(annonce.id, publiques);
    return publiques;
  }
  if (annonce.portail !== 'pap' || !annonce.url) return [];
  const page = await telechargerPage(annonce.url);
  if (!page.ok) return [];
  const photos = extrairePhotosPap(page.html);
  if (photos.length > 0) await garderPhotos(annonce.id, photos);
  return photos;
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }
  const { id } = await ctx.params;
  const relire = new URL(req.url).searchParams.get('lire') === '1';
  const supabase = await createSupabaseServerClient();
  const lue = await lireAnnonce(supabase, id);
  if (!lue) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });
  const { annonce, soeurs } = lue;
  const [evenements, photos] = await Promise.all([
    lireEvenements(
      supabase,
      soeurs.map((a) => a.id),
    ),
    photosDeLAnnonce(annonce, relire).catch((err: unknown) => {
      console.error('[annonces] photos', err instanceof Error ? err.name : 'réseau');
      return [] as string[];
    }),
  ]);
  return NextResponse.json({
    lignes: evenements.map((e) => ({ id: e.id, texte: ligneHistorique(e, annonce.premiereVueLe) })),
    raisons: annonce.confiance === 'adresse_publiee'
      ? annonce.raisonsLocalisation.filter((r) => !/dpe/i.test(r))
      : annonce.raisonsLocalisation,
    parcelleIds: annonce.parcelleIds,
    photos,
  });
}
