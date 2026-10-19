import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { lireAnnonce, lireEvenements } from '@/lib/annonces/lire';
import { photosPubliques } from '@/lib/annonces/photos';
import { ligneHistorique } from '@/lib/annonces/presenter';

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }
  const { id } = await ctx.params;
  const supabase = await createSupabaseServerClient();
  const lue = await lireAnnonce(supabase, id);
  if (!lue) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });
  const { annonce, soeurs } = lue;
  const [evenements, photos] = await Promise.all([
    lireEvenements(
      supabase,
      soeurs.map((a) => a.id),
    ),
    photosPubliques(annonce.portail, annonce.url),
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
