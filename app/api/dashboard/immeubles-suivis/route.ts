import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getServerUser } from '@/lib/auth/getServerUser';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { normalizeParcelleId } from '@/lib/carte/parcelle-id';
import { notifierSuiviImmeuble } from '@/lib/notifications/evenements';

export const runtime = 'nodejs';

/**
 * « Suivre cet immeuble » depuis la fiche parcelle. Chaque agent ne voit et
 * ne gère que ses propres suivis (RLS). Le cron quotidien transforme ce qui
 * arrive sur la parcelle — DPE, vente, audit — en proposition « À valider ».
 *
 * Tant que la table n'existe pas, `disponible: false` : le bouton reste caché.
 */

/** La table n'existe pas encore (migration 20260947 non appliquée). */
function tableAbsente(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === '42P01' || error.code === 'PGRST205' || /does not exist|could not find the table/i.test(error.message ?? '');
}

async function session() {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) return null;
  // Table hors des types générés : client non typé, la RLS fait foi.
  const db = (await createSupabaseServerClient()) as unknown as SupabaseClient;
  return { profile, agency, db };
}

export async function GET(req: Request) {
  const s = await session();
  if (!s) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  const parcelleRaw = new URL(req.url).searchParams.get('parcelle');

  // Sans ?parcelle= : liste pour la carte.
  if (!parcelleRaw) {
    const { data, error } = await s.db
      .from('immeubles_suivis')
      .select('parcelle_id, ban_id, libelle')
      .eq('profile_id', s.profile.id)
      .order('cree_le', { ascending: false });
    if (tableAbsente(error)) return NextResponse.json({ disponible: false, suivis: [] });
    if (error) return NextResponse.json({ error: 'Lecture impossible' }, { status: 500 });
    const suivis = (data ?? []).map((row) => ({
      parcelleId: String((row as { parcelle_id: string }).parcelle_id),
      banId: (row as { ban_id: string | null }).ban_id ?? null,
      libelle: (row as { libelle: string | null }).libelle ?? null,
    }));
    return NextResponse.json({ disponible: true, suivis });
  }

  const parcelleId = normalizeParcelleId(parcelleRaw);
  if (!parcelleId) return NextResponse.json({ error: 'Parcelle inconnue' }, { status: 400 });

  const { data, error } = await s.db
    .from('immeubles_suivis')
    .select('id')
    .eq('profile_id', s.profile.id)
    .eq('parcelle_id', parcelleId)
    .maybeSingle();
  if (tableAbsente(error)) return NextResponse.json({ disponible: false, suivi: false });
  if (error) return NextResponse.json({ error: 'Lecture impossible' }, { status: 500 });
  return NextResponse.json({ disponible: true, suivi: Boolean(data) });
}

export async function POST(req: Request) {
  const s = await session();
  if (!s) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
  }
  const parcelleId = normalizeParcelleId(typeof body.parcelleId === 'string' ? body.parcelleId : null);
  if (!parcelleId) return NextResponse.json({ error: 'Parcelle inconnue' }, { status: 400 });
  const banId = typeof body.banId === 'string' && body.banId.trim() ? body.banId.trim().slice(0, 60) : null;
  const libelle = typeof body.libelle === 'string' && body.libelle.trim() ? body.libelle.trim().slice(0, 200) : null;

  const { data, error } = await s.db
    .from('immeubles_suivis')
    .upsert(
      {
        agency_id: s.agency.id,
        profile_id: s.profile.id,
        parcelle_id: parcelleId,
        ban_id: banId,
        libelle,
      },
      { onConflict: 'profile_id,parcelle_id', ignoreDuplicates: true },
    )
    .select('id')
    .maybeSingle();
  if (tableAbsente(error)) return NextResponse.json({ error: 'Le suivi n’est pas encore disponible' }, { status: 503 });
  if (error) return NextResponse.json({ error: 'Le suivi n’a pas pu être enregistré' }, { status: 500 });

  // Nouvelle ligne seulement : pas de doublon si l’agent reclique.
  let notification = null;
  if (data?.id) {
    notification = await notifierSuiviImmeuble({
      agencyId: s.agency.id,
      profileId: s.profile.id,
      parcelleId,
      libelle,
    });
  }
  return NextResponse.json({ suivi: true, notification });
}

export async function DELETE(req: Request) {
  const s = await session();
  if (!s) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  const parcelleId = normalizeParcelleId(new URL(req.url).searchParams.get('parcelle'));
  if (!parcelleId) return NextResponse.json({ error: 'Parcelle inconnue' }, { status: 400 });

  const { error } = await s.db
    .from('immeubles_suivis')
    .delete()
    .eq('profile_id', s.profile.id)
    .eq('parcelle_id', parcelleId);
  if (tableAbsente(error)) return NextResponse.json({ suivi: false });
  if (error) return NextResponse.json({ error: 'Le suivi n’a pas pu être retiré' }, { status: 500 });
  return NextResponse.json({ suivi: false });
}
