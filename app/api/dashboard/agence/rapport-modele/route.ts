import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { requireDirector } from '@/lib/auth/requireDirector';
import { mapPageBibliotheque } from '@/lib/rapport/pages';
import { nomSlotModele, parseSlotsModele, slotsDepuisLignes, texteEmailModele, type SlotModele } from '@/lib/rapport/modele-defaut';
import { signerCheminRapport } from '@/lib/rapport/storage';

export const runtime = 'nodejs';

function payloadSlots(slots: SlotModele[], agencyId: string) {
  return slots.map((slot, position) =>
    slot.source === 'bibliotheque'
      ? {
          agency_id: agencyId,
          position,
          source: 'bibliotheque' as const,
          bibliotheque_id: slot.bibliothequeId,
          kind_generee: null,
        }
      : {
          agency_id: agencyId,
          position,
          source: 'generee' as const,
          bibliotheque_id: null,
          kind_generee: slot.kindGeneree,
        },
  );
}

export async function GET() {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const session = await createSupabaseServerClient();
  const [{ data: modeleRows }, { data: biblioRows }, { data: agence }] = await Promise.all([
    session
      .from('agency_rapport_modele')
      .select('source, bibliotheque_id, kind_generee')
      .eq('agency_id', agency.id)
      .order('position', { ascending: true })
      .order('created_at', { ascending: true }),
    session
      .from('agency_rapport_pages')
      .select('*')
      .eq('agency_id', agency.id)
      .order('position', { ascending: true })
      .order('created_at', { ascending: true }),
    session.from('agencies').select('rapport_email_modele').eq('id', agency.id).maybeSingle(),
  ]);

  const parId = new Map((biblioRows ?? []).map((p) => [p.id, p]));
  const slots = slotsDepuisLignes(modeleRows ?? []).filter((slot) => {
    if (slot.source === 'generee') return true;
    return parId.has(slot.bibliothequeId);
  });

  const pages = await Promise.all(
    (biblioRows ?? []).map(async (row) =>
      mapPageBibliotheque(row, row.storage_path ? await signerCheminRapport(row.storage_path) : null),
    ),
  );

  return NextResponse.json({
    slots: slots.map((slot) => ({
      ...slot,
      nom: nomSlotModele(slot, parId),
    })),
    pages,
    emailModele: texteEmailModele(agence?.rapport_email_modele),
  });
}

export async function PUT(req: Request) {
  const guard = await requireDirector();
  if (!guard.ok) return guard.response;

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  const session = await createSupabaseServerClient();

  if (Object.prototype.hasOwnProperty.call(body, 'slots')) {
    const slots = parseSlotsModele(body.slots);
    if (!slots) {
      return NextResponse.json({ error: 'Modèle invalide' }, { status: 400 });
    }
    const { data: biblioRows } = await session
      .from('agency_rapport_pages')
      .select('id')
      .eq('agency_id', guard.agency.id);
    const autorises = new Set((biblioRows ?? []).map((p) => p.id));
    for (const slot of slots) {
      if (slot.source === 'bibliotheque' && !autorises.has(slot.bibliothequeId)) {
        return NextResponse.json({ error: 'Page inconnue' }, { status: 400 });
      }
    }
    const { error: delErr } = await session
      .from('agency_rapport_modele')
      .delete()
      .eq('agency_id', guard.agency.id);
    if (delErr) return NextResponse.json({ error: 'Enregistrement impossible' }, { status: 500 });
    if (slots.length > 0) {
      const { error: insErr } = await session
        .from('agency_rapport_modele')
        .insert(payloadSlots(slots, guard.agency.id));
      if (insErr) return NextResponse.json({ error: 'Enregistrement impossible' }, { status: 500 });
    }
  }

  if (typeof body.emailModele === 'string') {
    const texte = body.emailModele.trim();
    if (texte.length > 4000) {
      return NextResponse.json({ error: 'Message trop long' }, { status: 400 });
    }
    const { error } = await session
      .from('agencies')
      .update({ rapport_email_modele: texte.length > 0 ? texte : null })
      .eq('id', guard.agency.id);
    if (error) return NextResponse.json({ error: 'Enregistrement impossible' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
