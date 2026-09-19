import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { clientIpFromRequest, rateLimit } from '@/lib/rate-limit';
import { estNextResponse, sessionRapportEstimation } from '@/lib/rapport/acces';
import {
  extensionMime,
  kindDepuisMime,
  mapPageComposee,
  MAX_PAGES_PDF,
  MAX_RAPPORT_UPLOAD_BYTES,
  MIME_PAGES,
  nomFichierPropre,
} from '@/lib/rapport/pages';
import { cheminImport, deposerRapport, signerCheminRapport } from '@/lib/rapport/storage';
import { compterPagesPdf } from '@/lib/rapport/pdf';

export const runtime = 'nodejs';
export const maxDuration = 30;

async function prochainePosition(estimationId: string): Promise<number> {
  const session = await createSupabaseServerClient();
  const { data } = await session
    .from('estimation_rapport_pages')
    .select('position')
    .eq('estimation_id', estimationId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.position ?? -1) + 1;
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await sessionRapportEstimation(id);
  if (estNextResponse(ctx)) return ctx;

  const limit = rateLimit(`rapport-compose:${clientIpFromRequest(req)}`, {
    limit: 40,
    windowMs: 10 * 60 * 1000,
  });
  if (!limit.ok) return NextResponse.json({ error: 'Trop d’ajouts' }, { status: 429 });

  const contentType = req.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return ajouterDepuisBibliotheque(ctx.estimation.id, ctx.agency.id, req);
  }
  return importerFichier(ctx.estimation.id, ctx.agency.id, req);
}

async function ajouterDepuisBibliotheque(estimationId: string, agencyId: string, req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
  }
  const bibliothequeId = typeof body.bibliothequeId === 'string' ? body.bibliothequeId : '';
  if (!bibliothequeId) {
    return NextResponse.json({ error: 'Page de bibliothèque manquante' }, { status: 400 });
  }

  const session = await createSupabaseServerClient();
  const { data: source } = await session
    .from('agency_rapport_pages')
    .select('*')
    .eq('id', bibliothequeId)
    .eq('agency_id', agencyId)
    .maybeSingle();
  if (!source) {
    return NextResponse.json({ error: 'Page introuvable dans la bibliothèque' }, { status: 404 });
  }

  const start = await prochainePosition(estimationId);
  const rows = Array.from({ length: source.page_count }, (_, i) => ({
    estimation_id: estimationId,
    agency_id: agencyId,
    source: 'bibliotheque' as const,
    bibliotheque_id: source.id,
    nom: source.page_count > 1 ? `${source.nom} (${i + 1})` : source.nom,
    kind: source.kind,
    storage_path: source.storage_path,
    mime_type: source.mime_type,
    page_index: i,
    position: start + i,
  }));

  const { data, error } = await session.from('estimation_rapport_pages').insert(rows).select('*');
  if (error || !data) {
    return NextResponse.json({ error: 'Ajout impossible' }, { status: 500 });
  }

  const pages = await Promise.all(
    data.map(async (row) =>
      mapPageComposee(row, row.storage_path ? await signerCheminRapport(row.storage_path) : null),
    ),
  );
  return NextResponse.json({ pages });
}

async function importerFichier(estimationId: string, agencyId: string, req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
  }
  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Fichier manquant' }, { status: 400 });
  }
  if (file.size > MAX_RAPPORT_UPLOAD_BYTES) {
    return NextResponse.json({ error: 'Fichier trop lourd (15 Mo max.)' }, { status: 413 });
  }
  const mime = (file.type || '').split(';')[0];
  const kind = kindDepuisMime(mime);
  if (!MIME_PAGES.has(mime) || !kind) {
    return NextResponse.json({ error: 'PDF ou image (JPEG, PNG, WebP)' }, { status: 415 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  let pageCount = 1;
  if (kind === 'pdf') {
    try {
      pageCount = await compterPagesPdf(bytes);
    } catch {
      return NextResponse.json({ error: 'PDF illisible' }, { status: 400 });
    }
    if (pageCount > MAX_PAGES_PDF) {
      return NextResponse.json({ error: 'PDF trop long (40 pages max.)' }, { status: 400 });
    }
  }

  const nom =
    typeof form.get('nom') === 'string' && form.get('nom')!.toString().trim()
      ? form.get('nom')!.toString().trim().slice(0, 80)
      : nomFichierPropre(file.name);

  const fileId = crypto.randomUUID();
  const path = cheminImport(agencyId, estimationId, fileId, extensionMime(mime));
  const { error: upErr } = await deposerRapport(path, Buffer.from(bytes), mime);
  if (upErr) {
    console.error('[rapport] import', upErr);
    return NextResponse.json({ error: 'Envoi impossible' }, { status: 500 });
  }

  const start = await prochainePosition(estimationId);
  const session = await createSupabaseServerClient();
  const rows = Array.from({ length: pageCount }, (_, i) => ({
    estimation_id: estimationId,
    agency_id: agencyId,
    source: 'import' as const,
    bibliotheque_id: null,
    nom: pageCount > 1 ? `${nom} (${i + 1})` : nom,
    kind,
    storage_path: path,
    mime_type: mime,
    page_index: i,
    position: start + i,
  }));

  const { data, error } = await session.from('estimation_rapport_pages').insert(rows).select('*');
  if (error || !data) {
    return NextResponse.json({ error: 'Ajout impossible' }, { status: 500 });
  }

  const pages = await Promise.all(
    data.map(async (row) =>
      mapPageComposee(row, row.storage_path ? await signerCheminRapport(row.storage_path) : null),
    ),
  );
  return NextResponse.json({ pages });
}
