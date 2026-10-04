import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { viewerFromProfile } from '@/lib/agency/visibility';
import { canSeeVoiceNote } from '@/lib/notes/visibility';
import { fetchMembersOfMyAgency } from '@/lib/queries/agency-members';
import { rateLimit } from '@/lib/rate-limit';
import { resumerMemoire, type SourceMemoire } from '@/lib/notes/memoire';
import { MistralKeyMissingError, requireMistralKey } from '@/lib/voice/transcribe';
import { reponseQuotaIa, reserverIa } from '@/lib/ia/quota';

export const runtime = 'nodejs';
export const maxDuration = 45;

type NoteLue = {
  id: string;
  transcript: string | null;
  created_at: string;
  created_by: string | null;
  visibilite: string | null;
};

/**
 * « Ce que l'agence sait » sur un contact ou un immeuble : ses notes et ses
 * échanges, relus en quelques lignes. Lecture sous RLS, et les notes privées
 * d'un collègue restent privées.
 */
export async function POST(req: Request) {
  const { user, profile, agency, memberships } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }
  const limit = rateLimit(`memoire:${profile.id}`, { limit: 40, windowMs: 60 * 60 * 1000 });
  if (!limit.ok) return NextResponse.json({ error: 'Trop de demandes' }, { status: 429 });
  if (!(await reserverIa('redaction'))) return reponseQuotaIa();

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
  }
  const contactId = typeof body.contactId === 'string' ? body.contactId.trim() : '';
  const banId = typeof body.banId === 'string' ? body.banId.trim() : '';
  if (!contactId && !banId) return NextResponse.json({ error: 'Rien à résumer' }, { status: 400 });

  const supabase = await createSupabaseServerClient();
  const viewer = viewerFromProfile(profile);

  // Les notes rattachées, par lien ou par le champ historique.
  const entite = contactId
    ? { type: 'contact' as const, id: contactId }
    : { type: 'immeuble' as const, id: banId };
  const [{ data: liens }, direct] = await Promise.all([
    supabase.from('note_liens').select('note_id').eq('entite_type', entite.type).eq('entite_id', entite.id).limit(80),
    contactId
      ? supabase.from('voice_notes').select('id').eq('contact_id', contactId).limit(80)
      : supabase.from('voice_notes').select('id').eq('ban_id', banId).limit(80),
  ]);
  const ids = [
    ...new Set([
      ...((liens ?? []) as { note_id: string }[]).map((l) => l.note_id),
      ...((direct.data ?? []) as { id: string }[]).map((n) => n.id),
    ]),
  ];

  const [{ data: notes }, echanges, sujetLu, membres] = await Promise.all([
    ids.length
      ? supabase
          .from('voice_notes')
          .select('id, transcript, created_at, created_by, visibilite')
          .in('id', ids)
          .order('created_at', { ascending: false })
          .limit(40)
      : Promise.resolve({ data: [] as NoteLue[] }),
    contactId
      ? supabase
          .from('contact_interactions')
          .select('body, occurred_at, author_id, voice_note_id')
          .eq('contact_id', contactId)
          .order('occurred_at', { ascending: false })
          .limit(20)
      : Promise.resolve({ data: [] }),
    contactId
      ? supabase.from('contacts').select('first_name, last_name').eq('id', contactId).maybeSingle()
      : Promise.resolve({ data: null }),
    fetchMembersOfMyAgency(agency.id, memberships).catch(() => []),
  ]);

  const nomDe = new Map(membres.map((m) => [m.id, m.fullName]));
  const visibles = ((notes ?? []) as NoteLue[]).filter(
    (n) =>
      n.transcript?.trim() &&
      canSeeVoiceNote(viewer, { visibilite: n.visibilite === 'privee' ? 'privee' : 'agence', createdBy: n.created_by }),
  );
  const notesVues = new Set(visibles.map((n) => n.id));
  const sources: SourceMemoire[] = [
    ...visibles.map((n) => ({
      date: n.created_at.slice(0, 10),
      auteur: n.created_by ? nomDe.get(n.created_by) ?? null : null,
      texte: n.transcript!.trim(),
      type: 'note' as const,
    })),
    ...(((echanges.data ?? []) as { body: string; occurred_at: string; author_id: string | null; voice_note_id: string | null }[])
      // Un échange recopié d'une note serait lu deux fois.
      .filter((e) => e.body?.trim() && !(e.voice_note_id && notesVues.has(e.voice_note_id)))
      .map((e) => ({
        date: e.occurred_at.slice(0, 10),
        auteur: e.author_id ? nomDe.get(e.author_id) ?? null : null,
        texte: e.body.trim(),
        type: 'echange' as const,
      }))),
  ].sort((a, b) => b.date.localeCompare(a.date));

  if (sources.length === 0) {
    return NextResponse.json({ memoire: null, sources: 0 });
  }

  const sujetRow = sujetLu.data as { first_name: string | null; last_name: string | null } | null;
  const sujet = contactId
    ? [sujetRow?.first_name, sujetRow?.last_name].filter(Boolean).join(' ') || 'ce contact'
    : 'cet immeuble';

  try {
    const memoire = await resumerMemoire(sujet, sources, requireMistralKey());
    if (!memoire) return NextResponse.json({ error: 'Résumé indisponible' }, { status: 502 });
    return NextResponse.json({ memoire }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    if (err instanceof MistralKeyMissingError) {
      return NextResponse.json({ error: 'Résumé indisponible' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Résumé indisponible' }, { status: 502 });
  }
}
