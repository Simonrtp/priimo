import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { lireImageModele } from '@/lib/rapport/image-modele';
import { contenuDepuisJson, estDisposition } from '@/lib/rapport/modele';
import { extensionMime, mapPageBibliotheque } from '@/lib/rapport/pages';
import { cheminBiblio, deposerRapport, signerCheminRapport, supprimerRapport } from '@/lib/rapport/storage';
import { peutModifierPage } from '@/lib/rapport/propriete';
import type { AgencyRapportPageRow } from '@/types/database';

type PageUpdate = Partial<
  Pick<AgencyRapportPageRow, 'nom' | 'description' | 'disposition' | 'contenu' | 'storage_path' | 'mime_type'>
>;

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }
  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Identifiant manquant' }, { status: 400 });

  const session = await createSupabaseServerClient();
  const { data: current } = await session
    .from('agency_rapport_pages')
    .select('*')
    .eq('id', id)
    .eq('agency_id', agency.id)
    .maybeSingle();
  if (!current) return NextResponse.json({ error: 'Page introuvable' }, { status: 404 });
  if (!peutModifierPage(profile.role, profile.id, current.owner_id)) {
    return NextResponse.json({ error: 'Page non modifiable' }, { status: 403 });
  }

  const update: PageUpdate = {};
  let nextPath = current.storage_path as string | null;
  let nextMime = current.mime_type as string | null;
  let imageChangee = false;

  const contentType = req.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
    }
    appliquerChamps(update, body, current.kind);
    if (current.kind === 'modele' && body.retirerImage === true) {
      nextPath = null;
      nextMime = null;
      imageChangee = true;
    }
  } else {
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
    }
    appliquerChamps(
      update,
      {
        nom: form.get('nom'),
        description: form.get('description'),
        disposition: form.get('disposition'),
        contenu: form.get('contenu'),
      },
      current.kind,
    );
    const retirer = form.get('retirerImage') === '1' || form.get('retirerImage') === 'true';
    const imageLue = await lireImageModele(form.get('file'));
    if (imageLue && !imageLue.ok) {
      return NextResponse.json({ error: imageLue.error }, { status: imageLue.status });
    }
    if (imageLue?.ok) {
      if (current.kind !== 'modele') {
        return NextResponse.json({ error: 'Image réservée aux pages créées' }, { status: 400 });
      }
      const path = cheminBiblio(agency.id, id, extensionMime(imageLue.image.mime));
      const { error: upErr } = await deposerRapport(
        path,
        Buffer.from(imageLue.image.bytes),
        imageLue.image.mime,
      );
      if (upErr) {
        console.error('[rapport] modele image', upErr);
        return NextResponse.json({ error: 'Envoi impossible' }, { status: 500 });
      }
      nextPath = path;
      nextMime = imageLue.image.mime;
      imageChangee = true;
    } else if (current.kind === 'modele' && retirer) {
      nextPath = null;
      nextMime = null;
      imageChangee = true;
    }
  }

  if (imageChangee) {
    if (current.storage_path && current.storage_path !== nextPath) {
      await supprimerRapport(current.storage_path);
    }
    update.storage_path = nextPath;
    update.mime_type = nextMime;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Rien à modifier' }, { status: 400 });
  }

  const { data, error } = await session
    .from('agency_rapport_pages')
    .update(update)
    .eq('id', id)
    .eq('agency_id', agency.id)
    .select('*')
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: 'Page introuvable' }, { status: 404 });
  }

  return NextResponse.json({
    page: mapPageBibliotheque(data, data.storage_path ? await signerCheminRapport(data.storage_path) : null),
  });
}

function appliquerChamps(update: PageUpdate, body: Record<string, unknown>, kind: string) {
  if (typeof body.nom === 'string') {
    const nom = body.nom.trim().slice(0, 80);
    if (nom) update.nom = nom;
  }
  if (body.description === null || typeof body.description === 'string') {
    update.description =
      typeof body.description === 'string' ? body.description.trim().slice(0, 400) || null : null;
  }
  if (kind === 'modele') {
    if (estDisposition(body.disposition)) update.disposition = body.disposition;
    if (body.contenu !== undefined) update.contenu = contenuDepuisJson(body.contenu);
  }
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
    .select('id, storage_path, owner_id')
    .eq('id', id)
    .eq('agency_id', agency.id)
    .maybeSingle();
  if (!data) return NextResponse.json({ error: 'Page introuvable' }, { status: 404 });
  if (!peutModifierPage(profile.role, profile.id, data.owner_id)) {
    return NextResponse.json({ error: 'Page non modifiable' }, { status: 403 });
  }

  const { error } = await session
    .from('agency_rapport_pages')
    .delete()
    .eq('id', id)
    .eq('agency_id', agency.id);
  if (error) return NextResponse.json({ error: 'Suppression impossible' }, { status: 500 });

  await supprimerRapport(data.storage_path);
  return NextResponse.json({ ok: true });
}
