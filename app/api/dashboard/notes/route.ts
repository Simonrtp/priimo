import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { viewerFromProfile } from '@/lib/agency/visibility';
import { canSeeVoiceNote } from '@/lib/notes/visibility';
import { composeTypedNote, parseTypedNoteDraft } from '@/lib/notes/typed-compose';
import { mapDbVoiceNote } from '@/lib/queries/contacts';
import { mapDbNoteLien, NOTE_LIENS_SELECT } from '@/lib/notes/liens';
import { fetchMembersOfMyAgency } from '@/lib/queries/agency-members';
import { auteurNote, portraitsParId } from '@/lib/notes/auteur';
import { EMPTY_BAN_GEO, geocodeToColumns } from '@/lib/geo/fields';
import { clientIpFromRequest, rateLimit } from '@/lib/rate-limit';
import { formatParcelleId, normalizeParcelleId } from '@/lib/carte/parcelle-id';
import { invaliderNotesAccueil } from '@/lib/cache/dashboard';
import { linkNoteToParcelle } from '@/lib/notes/parcelle-lien';
import type { NoteLienEntite, NoteLien, TerrainNote } from '@/types/contact';
import type { NoteLienRow, VoiceNoteRow } from '@/types/database';

export const runtime = 'nodejs';
export const maxDuration = 60;

const TYPES: readonly NoteLienEntite[] = ['contact', 'bien', 'lead', 'immeuble', 'parcelle'];

export async function GET(req: Request) {
  const { user, profile, agency, memberships } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const url = new URL(req.url);
  const entiteTypeRaw = url.searchParams.get('entiteType');
  const entiteId = url.searchParams.get('entiteId')?.trim() ?? '';
  const entiteType =
    entiteTypeRaw && (TYPES as readonly string[]).includes(entiteTypeRaw)
      ? (entiteTypeRaw as NoteLienEntite)
      : null;

  if (!entiteType || !entiteId) {
    return NextResponse.json({ error: 'Filtre manquant' }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const viewer = viewerFromProfile(profile);

  let noteIds: string[] = [];
  if (entiteType === 'immeuble') {
    if (entiteId.startsWith('gps:')) {
      noteIds = [entiteId.slice(4)];
    } else {
      const { data: byBan } = await supabase
        .from('voice_notes')
        .select('id')
        .eq('agency_id', agency.id)
        .eq('ban_id', entiteId);
      noteIds = (byBan ?? []).map((r) => (r as { id: string }).id);
    }
  }

  const { data: lienRows } = await supabase
    .from('note_liens')
    .select(NOTE_LIENS_SELECT)
    .eq('agency_id', agency.id)
    .eq('entite_type', entiteType)
    .eq('entite_id', entiteId);

  const liens = ((lienRows ?? []) as unknown as NoteLienRow[]).map(mapDbNoteLien);
  for (const lien of liens) {
    if (!noteIds.includes(lien.noteId)) noteIds.push(lien.noteId);
  }

  if (noteIds.length === 0) return NextResponse.json({ notes: [] as TerrainNote[] });

  const { data: noteRows } = await supabase
    .from('voice_notes')
    .select(
      'id, agency_id, created_by, duration_seconds, transcript, transcript_original, status, statut, visibilite, source_info, contact_id, ban_id, latitude, longitude, adresse_normalisee, assigned_to, created_at, structured, storage_path, mime_type, updated_at',
    )
    .eq('agency_id', agency.id)
    .in('id', noteIds)
    .order('created_at', { ascending: false });

  const members = await fetchMembersOfMyAgency(agency.id, memberships);
  const auteurs = portraitsParId(members);

  const { data: allLiens } = await supabase
    .from('note_liens')
    .select(NOTE_LIENS_SELECT)
    .eq('agency_id', agency.id)
    .in('note_id', noteIds);

  const liensByNote = new Map<string, NoteLien[]>();
  for (const row of (allLiens ?? []) as unknown as NoteLienRow[]) {
    const lien = mapDbNoteLien(row);
    const list = liensByNote.get(lien.noteId) ?? [];
    list.push(lien);
    liensByNote.set(lien.noteId, list);
  }

  const notes: TerrainNote[] = ((noteRows ?? []) as unknown as VoiceNoteRow[])
    .map((row) => {
      const mapped = mapDbVoiceNote(row, {
        hasFicheLink: (liensByNote.get(row.id) ?? []).some(
          (l) => l.entiteType === 'contact' || l.entiteType === 'bien' || l.entiteType === 'lead',
        ),
      });
      const author = auteurNote(mapped.createdBy, auteurs);
      return {
        ...mapped,
        liens: liensByNote.get(row.id) ?? [],
        authorName: author?.fullName ?? null,
        author,
      };
    })
    .filter((n) => canSeeVoiceNote(viewer, { visibilite: n.visibilite, createdBy: n.createdBy }));

  return NextResponse.json({ notes });
}

const MAX_TYPED_CHARS = 8000;
const MIN_TYPED_CHARS = 8;

function parseLiensManuels(raw: unknown): { entiteType: NoteLienEntite; entiteId: string }[] {
  if (!Array.isArray(raw)) return [];
  const out: { entiteType: NoteLienEntite; entiteId: string }[] = [];
  const vus = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as { entiteType?: unknown; entiteId?: unknown };
    const entiteType =
      typeof row.entiteType === 'string' && (TYPES as readonly string[]).includes(row.entiteType)
        ? (row.entiteType as NoteLienEntite)
        : null;
    const entiteId = typeof row.entiteId === 'string' ? row.entiteId.trim() : '';
    if (!entiteType || !entiteId || entiteType === 'parcelle') continue;
    const key = `${entiteType}:${entiteId}`;
    if (vus.has(key)) continue;
    vus.add(key);
    out.push({ entiteType, entiteId });
  }
  return out.slice(0, 12);
}

function readCoord(body: Record<string, unknown>, key: string): number | null {
  const raw = body[key];
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return null;
  return raw;
}

/** Note écrite : même table que la dictée, sans audio. */
export async function POST(req: Request) {
  const ip = clientIpFromRequest(req);
  const limit = rateLimit(`note-typed:${ip}`, { limit: 40, windowMs: 60 * 60 * 1000 });
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Trop de notes coup sur coup. Réessayez dans un instant.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSec) } },
    );
  }

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

  const text = typeof body.text === 'string' ? body.text.trim() : '';
  const draft = parseTypedNoteDraft(body.draft);
  const adresseRaw = typeof body.adresse === 'string' ? body.adresse.trim().slice(0, 240) : '';
  const composed = draft ? composeTypedNote(draft, adresseRaw) : null;
  const transcript = (composed?.transcript || text).slice(0, MAX_TYPED_CHARS);
  if (transcript.length < MIN_TYPED_CHARS) {
    return NextResponse.json({ error: 'Écrivez un peu plus pour enregistrer la note.' }, { status: 400 });
  }
  const gpsLat = readCoord(body, 'latitude');
  const gpsLng = readCoord(body, 'longitude');
  const parcelleId = normalizeParcelleId(typeof body.parcelleId === 'string' ? body.parcelleId : null);
  const liensManuels = parseLiensManuels(body.liens);

  const admin = createSupabaseAdminClient();
  const voiceNoteId = crypto.randomUUID();
  const storagePath = `${agency.id}/${voiceNoteId}.typed`;

  const immeubleLien = liensManuels.find((l) => l.entiteType === 'immeuble');
  // Une parcelle sans adresse connue arrive avec sa référence cadastrale en
  // guise de libellé. La géocoder ne peut rien donner de juste : au mieux la
  // BAN ne répond pas, au pire elle rapproche un immeuble qui n'a rien à voir
  // et la note se pose ailleurs. Le lien parcelle suffit à la situer.
  const adresseEstReference =
    parcelleId !== null &&
    (adresseRaw === parcelleId || adresseRaw === formatParcelleId(parcelleId));
  const geoFromAdresse =
    adresseRaw.length >= 3 && !adresseEstReference
      ? await geocodeToColumns(adresseRaw)
      : { ...EMPTY_BAN_GEO };
  const hasClientCoords = gpsLat !== null && gpsLng !== null;
  const geo = {
    ...geoFromAdresse,
    latitude: hasClientCoords ? gpsLat : geoFromAdresse.latitude,
    longitude: hasClientCoords ? gpsLng : geoFromAdresse.longitude,
    adresse_normalisee: geoFromAdresse.adresse_normalisee ?? (adresseRaw || null),
    ban_id: immeubleLien?.entiteId ?? geoFromAdresse.ban_id ?? null,
  };
  const extraction = composed?.extraction ?? null;
  let contactId = liensManuels.find((l) => l.entiteType === 'contact')?.entiteId ?? null;

  try {
    const { error } = await admin.from('voice_notes').insert({
      id: voiceNoteId,
      agency_id: agency.id,
      created_by: profile.id,
      storage_path: storagePath,
      duration_seconds: null,
      mime_type: 'text/plain',
      transcript,
      structured: extraction,
      source_info: extraction?.sourceInfo ?? null,
      status: 'transcrit',
      statut: 'revue',
      visibilite: 'agence',
      contact_id: contactId,
      adresse_normalisee: geo.adresse_normalisee,
      ban_id: geo.ban_id,
      latitude: geo.latitude,
      longitude: geo.longitude,
      geocode_score: geo.geocode_score,
      geocode_le: geo.geocode_le,
    });
    if (error) throw error;
    if (parcelleId) {
      await linkNoteToParcelle(admin, { agencyId: agency.id, noteId: voiceNoteId, parcelleId });
    }
    if (liensManuels.length > 0) {
      const { error: lienErr } = await admin.from('note_liens').upsert(
        liensManuels.map((l) => ({
          note_id: voiceNoteId,
          agency_id: agency.id,
          entite_type: l.entiteType,
          entite_id: l.entiteId,
          confiance: 'certain' as const,
          cree_par: 'agent' as const,
        })),
        { onConflict: 'note_id,entite_type,entite_id' },
      );
      if (lienErr) console.error('[notes] liens manuels', lienErr);
    }
  } catch (err) {
    console.error('[notes] écriture', err);
    return NextResponse.json({ error: "La note n'a pas pu être enregistrée" }, { status: 500 });
  }

  invaliderNotesAccueil();

  return NextResponse.json({
    voiceNoteId,
    contactId,
  });
}
