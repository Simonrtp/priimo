import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { countComparables, fetchAddressContext } from '@/lib/estimation/dvf-engine';

export const runtime = 'nodejs';

/**
 * Une seule requête au moment où l’adresse est résolue.
 * Rapporte tout : ventes, copro, DPE, comparables potentiels (les deux types).
 * Les étapes suivantes lisent ce cache côté client — plus d’appel à chaque frappe.
 */
export async function POST(req: Request) {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
  }

  const latitude = Number(body.latitude);
  const longitude = Number(body.longitude);
  const postalCode = typeof body.postalCode === 'string' ? body.postalCode.trim() : '';
  const banId = typeof body.banId === 'string' && body.banId ? body.banId : null;

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !/^\d{5}$/.test(postalCode)) {
    return NextResponse.json({ error: 'Adresse incomplète' }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const context = await fetchAddressContext(admin, { banId, latitude, longitude, postalCode });

  const [comparablesAppartement, comparablesMaison] = await Promise.all([
    countComparables(admin, {
      latitude,
      longitude,
      postalCode,
      propertyType: 'appartement',
    }),
    countComparables(admin, {
      latitude,
      longitude,
      postalCode,
      propertyType: 'maison',
    }),
  ]);

  return NextResponse.json({
    resolved: context.resolved,
    city: typeof body.city === 'string' ? body.city : null,
    postalCode,
    immeubleVentes: context.immeubleVentes,
    derniereVente: context.derniereVente,
    coproLots: context.coproLots,
    coproPeriode: context.coproPeriode,
    dpeKnown: context.dpeKnown,
    dpeRepartition: context.dpeRepartition,
    parcelleKnown: context.parcelleKnown,
    comparablesAppartement,
    comparablesMaison,
    /** Rétrocompat : le panneau choisit selon le type déjà sélectionné. */
    comparables: null as number | null,
  });
}
