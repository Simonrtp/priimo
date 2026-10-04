import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { lireEntreprisesParSirens } from '@/lib/geo/annuaire-entreprises';
import { estEnAttente } from '@/lib/billing/acces';

export const runtime = 'nodejs';

/**
 * Enrichissement Annuaire pour les SCI / sociétés du volet parcelle.
 * Appelé après l’ouverture du volet (ne bloque pas la fiche).
 */
export async function GET(req: Request) {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }
  if (estEnAttente(agency)) {
    return NextResponse.json({ error: 'Indisponible' }, { status: 404 });
  }

  const raw = new URL(req.url).searchParams.get('sirens') ?? '';
  const sirens = raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => /^\d{9}$/.test(s))
    .slice(0, 8);

  if (sirens.length === 0) {
    return NextResponse.json({ entreprises: {} });
  }

  const fiches = await lireEntreprisesParSirens(sirens);
  const entreprises: Record<
    string,
    {
      dirigeants: { nom: string; qualite: string | null }[];
      siege: string | null;
      dateCreation: string | null;
      active: boolean | null;
    }
  > = {};
  for (const [siren, f] of fiches) {
    entreprises[siren] = {
      dirigeants: f.dirigeants,
      siege: f.siege,
      dateCreation: f.dateCreation,
      active: f.active,
    };
  }

  return NextResponse.json(
    { entreprises },
    { headers: { 'Cache-Control': 'private, max-age=3600, stale-while-revalidate=86400' } },
  );
}
