import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { buildPortfolioStats, countRendezVousSansSuite } from '@/lib/today/portfolio';
import { mondayOf } from '@/lib/today/weekly-snapshot';
import { upsertWeeklySnapshot } from '@/lib/queries/weekly-snapshots';

export const runtime = 'nodejs';

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== 'production';
  return req.headers.get('authorization') === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  const { data: agencies, error } = await admin.from('agencies').select('id');
  if (error) {
    console.error('[cron/weekly-portfolio]', error);
    return NextResponse.json({ error: 'Lecture agences impossible' }, { status: 500 });
  }

  const weekStart = mondayOf();
  let written = 0;

  for (const agency of agencies ?? []) {
    const agencyId = agency.id as string;
    const [biensRes, leadsRes, rdvRes, contactsRes, visitsRes] = await Promise.all([
      admin
        .from('biens')
        .select('id, mandat_statut, mandat_date, created_at')
        .eq('agency_id', agencyId),
      admin.from('leads').select('stage_id').eq('agency_id', agencyId),
      admin.from('rendez_vous').select('contact_id, fin').eq('agency_id', agencyId),
      admin.from('contacts').select('id, last_interaction_at').eq('agency_id', agencyId),
      admin.from('visites').select('bien_id').eq('agency_id', agencyId),
    ]);

    const visitCountByBienId: Record<string, number> = {};
    for (const row of visitsRes.data ?? []) {
      const id = (row as { bien_id?: string }).bien_id;
      if (id) visitCountByBienId[id] = (visitCountByBienId[id] ?? 0) + 1;
    }

    const lastInteraction: Record<string, string | null> = {};
    for (const c of contactsRes.data ?? []) {
      lastInteraction[(c as { id: string }).id] = (c as { last_interaction_at: string | null }).last_interaction_at;
    }

    const rdv = (rdvRes.data ?? []).map((r) => ({
      contactId: (r as { contact_id: string | null }).contact_id,
      fin: (r as { fin: string }).fin,
    }));

    const stats = buildPortfolioStats({
      biens: (biensRes.data ?? []).map((b) => ({
        id: (b as { id: string }).id,
        mandatStatut: (b as { mandat_statut: string }).mandat_statut,
        mandatDate: (b as { mandat_date: string | null }).mandat_date,
        createdAt: (b as { created_at: string }).created_at,
      })),
      visitCountByBienId,
      leads: (leadsRes.data ?? []).map((l) => ({
        stageId: (l as { stage_id: string | null }).stage_id,
      })),
      estimationStageId: null,
      rendezVousSansSuite: countRendezVousSansSuite(rdv, lastInteraction),
    });

    const byKind = Object.fromEntries(stats.counters.map((c) => [c.kind, c]));
    await upsertWeeklySnapshot(admin, agencyId, {
      weekStart,
      mandatsActifs: byKind['mandats-actifs']?.value ?? 0,
      leadsNonPris: byKind['leads-non-pris']?.value ?? 0,
      rdvSansSuite: byKind['rdv-sans-suite']?.value ?? byKind['estimations']?.value ?? 0,
      mandats60j: byKind['mandats-60j']?.value ?? 0,
    });
    written += 1;
  }

  return NextResponse.json({ ok: true, written, weekStart });
}
