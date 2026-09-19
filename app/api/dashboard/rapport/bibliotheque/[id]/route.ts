import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { mapPageBibliotheque } from '@/lib/rapport/pages';
import { signerCheminRapport, supprimerRapport } from '@/lib/rapport/storage';

export const runtime = 'nodejs';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }
  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Identifiant manquant' }, { status: 400 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
  }

  const patch: { nom?: string; description?: string | null } = {};
  if (typeof body.nom === 'string') {
    const nom = body.nom.trim().slice(0, 80);
    if (!nom) return NextResponse.json({ error: 'Nom requis' }, { status: 400 });
    patch.nom = nom;
  }
  if (body.description === null || typeof body.description === 'string') {
    patch.description =
      typeof body.description === 'string' ? body.description.trim().slice(0, 400) || null : null;
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Rien à modifier' }, { status: 400 });
  }

  const session = await createSupabaseServerClient();
  const { data, error } = await session
    .from('agency_rapport_pages')
    .update(patch)
    .eq('id', id)
    .eq('agency_id', agency.id)
    .select('*')
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: 'Page introuvable' }, { status: 404 });
  }

  return NextResponse.json({
    page: mapPageBibliotheque(data, await signerCheminRapport(data.storage_path)),
  });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }
  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Identifiant manquant' }, { status: 400 });

  const session = await createSupabaseServerClient();
  const { data } = await session
    .from('agency_rapport_pages')
    .select('id, storage_path')
    .eq('id', id)
    .eq('agency_id', agency.id)
    .maybeSingle();
  if (!data) return NextResponse.json({ error: 'Page introuvable' }, { status: 404 });

  const { error } = await session
    .from('agency_rapport_pages')
    .delete()
    .eq('id', id)
    .eq('agency_id', agency.id);
  if (error) return NextResponse.json({ error: 'Suppression impossible' }, { status: 500 });

  await supprimerRapport(data.storage_path);
  return NextResponse.json({ ok: true });
}
