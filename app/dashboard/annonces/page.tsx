import { redirect } from 'next/navigation';
import { getServerUser } from '@/lib/auth/getServerUser';
import { getDevice } from '@/lib/device-server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { fetchZonesSafe } from '@/lib/queries/zones';
import { lireAnnonces, lireRuns } from '@/lib/annonces/lire';
import AnnoncesBureau, { type FiltresAnnonces } from '@/components/dashboard/annonces/AnnoncesBureau';
import AnnoncesMobile from '@/app/dashboard/_mobile/AnnoncesMobile';

export const metadata = { title: 'Annonces' };

export default async function AnnoncesPage({
  searchParams,
}: {
  searchParams: Promise<{ mouvements?: string; nouvelles?: string; annonce?: string }>;
}) {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) redirect('/login');
  const params = await searchParams;
  const device = await getDevice();
  const supabase = await createSupabaseServerClient();
  const [annonces, runs, zones] = await Promise.all([
    lireAnnonces(supabase),
    lireRuns(supabase),
    fetchZonesSafe(supabase),
  ]);
  const initial: FiltresAnnonces = {
    secteur: 'mien',
    vendeur: 'particulier',
    statut: 'active',
    baisse: params.mouvements === '1',
    nouvelles: params.nouvelles === '1',
    dpe: '',
    pieces: '',
    prixMax: '',
    tri: params.mouvements === '1' ? 'baisse' : 'nouveau',
    annonce: params.annonce ?? null,
  };
  const commun = {
    annonces,
    runs,
    zones,
    directeur: profile.role === 'directeur',
    profileId: profile.id,
    initial,
  };
  if (device === 'mobile') return <AnnoncesMobile {...commun} />;
  return <AnnoncesBureau {...commun} mobile={false} />;
}
