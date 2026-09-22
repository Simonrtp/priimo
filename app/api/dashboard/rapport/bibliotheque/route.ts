import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { clientIpFromRequest, rateLimit } from '@/lib/rate-limit';
import { refuserSiEstimationFermee } from '@/lib/billing/exiger';
import { lireImageModele } from '@/lib/rapport/image-modele';
import {
  contenuDepuisJson,
  estDisposition,
  nomDepuisContenu,
  type ContenuPageModele,
} from '@/lib/rapport/modele';
import {
  detecterFichier,
  estFichierUpload,
  extensionMime,
  mapPageBibliotheque,
  MAX_PAGES_PDF,
  MAX_RAPPORT_UPLOAD_BYTES,
  nomFichierPropre,
} from '@/lib/rapport/pages';
import { cheminBiblio, deposerRapport, signerCheminRapport } from '@/lib/rapport/storage';
import { compterPagesPdf } from '@/lib/rapport/pdf-compter';
import { peutEditerBibliotheque } from '@/lib/rapport/propriete';
import type { DispositionPageAgence } from '@/types/database';

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
      mapPageBibliotheque(row, row.storage_path ? await signerCheminRapport(row.storage_path) : null),
    ),
  );
  return NextResponse.json({ pages });
}

export async function POST(req: Request) {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }
  if (!peutEditerBibliotheque(profile.role)) {
    return NextResponse.json({ error: 'Réservé au directeur' }, { status: 403 });
  }
  const ferme = refuserSiEstimationFermee(agency);
  if (ferme) return ferme;
  const limit = rateLimit(`rapport-biblio:${clientIpFromRequest(req)}`, {
    limit: 30,
    windowMs: 10 * 60 * 1000,
  });
  if (!limit.ok) return NextResponse.json({ error: 'Trop d’envois' }, { status: 429 });

  const contentType = req.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
    }
    return creerPageModele({
      agencyId: agency.id,
      profileId: profile.id,
      disposition: body.disposition,
      nom: body.nom,
      description: body.description,
      contenu: contenuDepuisJson(body.contenu),
      image: null,
    });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
  }

  if (typeof form.get('disposition') === 'string') {
    const imageLue = await lireImageModele(form.get('file'));
    if (imageLue && !imageLue.ok) {
      return NextResponse.json({ error: imageLue.error }, { status: imageLue.status });
    }
    return creerPageModele({
      agencyId: agency.id,
      profileId: profile.id,
      disposition: form.get('disposition'),
      nom: form.get('nom'),
      description: form.get('description'),
      contenu: contenuDepuisJson(form.get('contenu')),
      image: imageLue?.ok ? imageLue.image : null,
    });
  }

  return importerFichier(agency.id, profile.id, form);
}

async function prochainePosition(agencyId: string): Promise<number> {
  const session = await createSupabaseServerClient();
  const { data: last } = await session
    .from('agency_rapport_pages')
    .select('position')
    .eq('agency_id', agencyId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (last?.position ?? -1) + 1;
}

async function creerPageModele(input: {
  agencyId: string;
  profileId: string;
  disposition: unknown;
  nom: unknown;
  description: unknown;
  contenu: ContenuPageModele;
  image: { bytes: Uint8Array; mime: string } | null;
}) {
  if (!estDisposition(input.disposition)) {
    return NextResponse.json({ error: 'Choisissez une disposition' }, { status: 400 });
  }
  const disposition = input.disposition as DispositionPageAgence;
  const nomSaisi = typeof input.nom === 'string' ? input.nom.trim().slice(0, 80) : '';
  const nom = nomSaisi || nomDepuisContenu(input.contenu, disposition);
  const description =
    typeof input.description === 'string' ? input.description.trim().slice(0, 400) || null : null;

  const id = crypto.randomUUID();
  let storagePath: string | null = null;
  let mimeType: string | null = null;
  if (input.image) {
    storagePath = cheminBiblio(input.agencyId, id, extensionMime(input.image.mime));
    const { error: upErr } = await deposerRapport(
      storagePath,
      Buffer.from(input.image.bytes),
      input.image.mime,
    );
    if (upErr) {
      console.error('[rapport] modele image', upErr);
      return NextResponse.json({ error: 'Envoi impossible' }, { status: 500 });
    }
    mimeType = input.image.mime;
  }

  const session = await createSupabaseServerClient();
  const { data, error } = await session
    .from('agency_rapport_pages')
    .insert({
      id,
      agency_id: input.agencyId,
      nom,
      description,
      kind: 'modele',
      storage_path: storagePath,
      mime_type: mimeType,
      page_count: 1,
      position: await prochainePosition(input.agencyId),
      disposition,
      contenu: input.contenu,
      created_by: input.profileId,
    })
    .select('*')
    .single();

  if (error || !data) {
    console.error('[rapport] modele insert', error);
    return NextResponse.json({ error: 'Enregistrement impossible' }, { status: 500 });
  }

  return NextResponse.json({
    page: mapPageBibliotheque(data, storagePath ? await signerCheminRapport(storagePath) : null),
  });
}

async function importerFichier(agencyId: string, profileId: string, form: FormData) {
  const file = form.get('file');
  if (!estFichierUpload(file) || file.size === 0) {
    return NextResponse.json({ error: 'Fichier manquant' }, { status: 400 });
  }
  if (file.size > MAX_RAPPORT_UPLOAD_BYTES) {
    return NextResponse.json({ error: 'Fichier trop lourd (15 Mo max.)' }, { status: 413 });
  }

  const nomFichier = 'name' in file ? String(file.name) : '';
  const bytes = new Uint8Array(await file.arrayBuffer());
  const detecte = detecterFichier({ type: file.type, name: nomFichier }, bytes);
  if (!detecte) {
    return NextResponse.json({ error: 'PDF ou image (JPEG, PNG, WebP)' }, { status: 415 });
  }
  const { mime, kind } = detecte;

  const nom =
    typeof form.get('nom') === 'string' && form.get('nom')!.toString().trim()
      ? form.get('nom')!.toString().trim().slice(0, 80)
      : nomFichierPropre(nomFichier);
  const description =
    typeof form.get('description') === 'string'
      ? form.get('description')!.toString().trim().slice(0, 400) || null
      : null;

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

  const id = crypto.randomUUID();
  const path = cheminBiblio(agencyId, id, extensionMime(mime));
  const { error: upErr } = await deposerRapport(path, Buffer.from(bytes), mime);
  if (upErr) {
    console.error('[rapport] biblio upload', upErr);
    return NextResponse.json({ error: 'Envoi impossible' }, { status: 500 });
  }

  const session = await createSupabaseServerClient();
  const { data, error } = await session
    .from('agency_rapport_pages')
    .insert({
      id,
      agency_id: agencyId,
      nom,
      description,
      kind,
      storage_path: path,
      mime_type: mime,
      page_count: pageCount,
      position: await prochainePosition(agencyId),
      created_by: profileId,
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
