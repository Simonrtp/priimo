import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { clientIpFromRequest, rateLimit } from '@/lib/rate-limit';
import { refuserSiEstimationFermee } from '@/lib/billing/exiger';
import {
  extensionMime,
  kindDepuisMime,
  mapPageBibliotheque,
  MAX_PAGES_PDF,
  MAX_RAPPORT_UPLOAD_BYTES,
  MIME_PAGES,
  nomFichierPropre,
} from '@/lib/rapport/pages';
import { cheminBiblio, deposerRapport, signerCheminRapport } from '@/lib/rapport/storage';
import { compterPagesPdf } from '@/lib/rapport/pdf';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function GET() {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const session = await createSupabaseServerClient();
  const { data, error } = await session
    .from('agency_rapport_pages')
    .select('*')
    .eq('agency_id', agency.id)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: 'Bibliothèque indisponible' }, { status: 500 });
  }

  const pages = await Promise.all(
    (data ?? []).map(async (row) =>
      mapPageBibliotheque(row, await signerCheminRapport(row.storage_path)),
    ),
  );
  return NextResponse.json({ pages });
}

export async function POST(req: Request) {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }
  const ferme = refuserSiEstimationFermee(agency);
  if (ferme) return ferme;
  const limit = rateLimit(`rapport-biblio:${clientIpFromRequest(req)}`, {
    limit: 30,
    windowMs: 10 * 60 * 1000,
  });
  if (!limit.ok) return NextResponse.json({ error: 'Trop d’envois' }, { status: 429 });

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

  const nom =
    typeof form.get('nom') === 'string' && form.get('nom')!.toString().trim()
      ? form.get('nom')!.toString().trim().slice(0, 80)
      : nomFichierPropre(file.name);
  const description =
    typeof form.get('description') === 'string'
      ? form.get('description')!.toString().trim().slice(0, 400) || null
      : null;

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

  const session = await createSupabaseServerClient();
  const { data: last } = await session
    .from('agency_rapport_pages')
    .select('position')
    .eq('agency_id', agency.id)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();
  const position = (last?.position ?? -1) + 1;
  const id = crypto.randomUUID();
  const path = cheminBiblio(agency.id, id, extensionMime(mime));
  const { error: upErr } = await deposerRapport(path, Buffer.from(bytes), mime);
  if (upErr) {
    console.error('[rapport] biblio upload', upErr);
    return NextResponse.json({ error: 'Envoi impossible' }, { status: 500 });
  }

  const { data, error } = await session
    .from('agency_rapport_pages')
    .insert({
      id,
      agency_id: agency.id,
      nom,
      description,
      kind,
      storage_path: path,
      mime_type: mime,
      page_count: pageCount,
      position,
      created_by: profile.id,
    })
    .select('*')
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Enregistrement impossible' }, { status: 500 });
  }

  return NextResponse.json({
    page: mapPageBibliotheque(data, await signerCheminRapport(path)),
  });
}
