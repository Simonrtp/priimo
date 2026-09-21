import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { clientIpFromRequest, rateLimit } from '@/lib/rate-limit';
import { refuserSiEstimationFermee } from '@/lib/billing/exiger';
import { extensionMime, mapPageBibliotheque } from '@/lib/rapport/pages';
import { cheminBiblio, copierRapport, signerCheminRapport } from '@/lib/rapport/storage';
import { ownerPourCreation } from '@/lib/rapport/propriete';

export const runtime = 'nodejs';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }
  const ferme = refuserSiEstimationFermee(agency);
  if (ferme) return ferme;
  const limit = rateLimit(`rapport-biblio-dup:${clientIpFromRequest(req)}`, {
    limit: 30,
    windowMs: 10 * 60 * 1000,
  });
  if (!limit.ok) return NextResponse.json({ error: 'Trop de copies' }, { status: 429 });

  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Identifiant manquant' }, { status: 400 });

  let personnel = false;
  try {
    const body = (await req.json()) as { personnel?: unknown };
    personnel = body.personnel === true;
  } catch {
    /* POST sans corps : copie dans le même périmètre */
  }

  const session = await createSupabaseServerClient();
  const { data: source } = await session
    .from('agency_rapport_pages')
    .select('*')
    .eq('id', id)
    .eq('agency_id', agency.id)
    .maybeSingle();
  if (!source) return NextResponse.json({ error: 'Page introuvable' }, { status: 404 });

  const ownerId = personnel
    ? profile.id
    : ownerPourCreation(profile.role, profile.id, source.owner_id == null);
  let lastQ = session
    .from('agency_rapport_pages')
    .select('position')
    .eq('agency_id', agency.id)
    .order('position', { ascending: false })
    .limit(1);
  lastQ = ownerId == null ? lastQ.is('owner_id', null) : lastQ.eq('owner_id', ownerId);
  const { data: last } = await lastQ.maybeSingle();

  const copieId = crypto.randomUUID();
  let storagePath = source.storage_path;
  if (source.storage_path && source.mime_type) {
    const dest = cheminBiblio(agency.id, copieId, extensionMime(source.mime_type));
    const { error: copyErr } = await copierRapport(source.storage_path, dest);
    if (copyErr) {
      console.error('[rapport] dupliquer', copyErr);
      return NextResponse.json({ error: 'Copie impossible' }, { status: 500 });
    }
    storagePath = dest;
  }

  const nomBase = source.nom.replace(/\s*\(copie\)\s*$/i, '').trim() || source.nom;
  const nom = personnel ? nomBase : `${nomBase} (copie)`;
  const { data, error } = await session
    .from('agency_rapport_pages')
    .insert({
      id: copieId,
      agency_id: agency.id,
      nom: nom.slice(0, 80),
      description: source.description,
      kind: source.kind,
      storage_path: storagePath,
      mime_type: source.mime_type,
      page_count: source.page_count,
      position: (last?.position ?? -1) + 1,
      disposition: source.disposition ?? null,
      contenu: source.contenu ?? {},
      created_by: profile.id,
      owner_id: ownerId,
    })
    .select('*')
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Copie impossible' }, { status: 500 });
  }

  return NextResponse.json({
    page: mapPageBibliotheque(data, data.storage_path ? await signerCheminRapport(data.storage_path) : null),
  });
}
