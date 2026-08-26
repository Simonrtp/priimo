import type { SupabaseClient } from '@supabase/supabase-js';
import type { WeeklyPortfolioSnapshot } from '@/lib/today/weekly-snapshot';
import { mondayOf } from '@/lib/today/weekly-snapshot';

type Client = SupabaseClient;

type SnapTable = {
  from: (table: 'agency_weekly_snapshots') => {
    select: (cols: string) => {
      eq: (col: string, val: string) => {
        eq: (col: string, val: string) => {
          maybeSingle: () => Promise<{ data: SnapRow | null; error: { message: string } | null }>;
        };
      };
    };
    upsert: (
      row: Record<string, unknown>,
      opts: { onConflict: string },
    ) => Promise<{ error: { message: string } | null }>;
  };
};

function snaps(supabase: Client) {
  return supabase as unknown as SnapTable;
}

type SnapRow = {
  week_start: string;
  mandats_actifs: number;
  leads_non_pris: number;
  rdv_sans_suite: number;
  mandats_60j: number;
};

function mapRow(row: SnapRow): WeeklyPortfolioSnapshot {
  return {
    weekStart: String(row.week_start).slice(0, 10),
    mandatsActifs: row.mandats_actifs,
    leadsNonPris: row.leads_non_pris,
    rdvSansSuite: row.rdv_sans_suite,
    mandats60j: row.mandats_60j,
  };
}

export async function fetchWeeklySnapshot(
  supabase: Client,
  agencyId: string,
  weekStart: string,
): Promise<WeeklyPortfolioSnapshot | null> {
  const { data, error } = await snaps(supabase)
    .from('agency_weekly_snapshots')
    .select('week_start, mandats_actifs, leads_non_pris, rdv_sans_suite, mandats_60j')
    .eq('agency_id', agencyId)
    .eq('week_start', weekStart)
    .maybeSingle();
  if (error || !data) return null;
  return mapRow(data as SnapRow);
}

export async function upsertWeeklySnapshot(
  supabase: Client,
  agencyId: string,
  snap: WeeklyPortfolioSnapshot,
): Promise<void> {
  const { error } = await snaps(supabase).from('agency_weekly_snapshots').upsert(
    {
      agency_id: agencyId,
      week_start: snap.weekStart,
      mandats_actifs: snap.mandatsActifs,
      leads_non_pris: snap.leadsNonPris,
      rdv_sans_suite: snap.rdvSansSuite,
      mandats_60j: snap.mandats60j,
    },
    { onConflict: 'agency_id,week_start' },
  );
  if (error) console.error('[weekly-snapshot] écriture', error);
}

export async function snapshotFromCounters(
  counters: {
    mandatsActifs: number;
    leadsNonPris: number;
    rdvSansSuite: number;
    mandats60j: number;
  },
  weekStart = mondayOf(),
): Promise<WeeklyPortfolioSnapshot> {
  return { weekStart, ...counters };
}
