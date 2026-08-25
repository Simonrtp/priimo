import type { SupabaseClient } from '@supabase/supabase-js';
import type { AgencyAlertKind } from '@/lib/agency/alerts';
import { AGENCY_ALERT_LABELS, isAgencyAlertKind } from '@/lib/agency/alerts';
import type { Database } from '@/types/database';

type Client = SupabaseClient<Database>;

export type TodayAlertItem = {
  id: string;
  kind: AgencyAlertKind;
  createdByName: string;
  headline: string;
  context: string;
  contactId: string | null;
  leadId: string | null;
};

type AlertRow = {
  id: string;
  kind: string;
  created_by: string;
  contact_id: string | null;
  lead_id: string | null;
  body: string | null;
};

/**
 * Signalements urgents de l'agence. Absents si la table n'existe pas encore.
 */
export async function fetchAgencyAlerts(
  supabase: Client,
  namesById: ReadonlyMap<string, string>,
): Promise<TodayAlertItem[]> {
  try {
    const { data, error } = await supabase
      .from('agency_alerts')
      .select('id, kind, created_by, contact_id, lead_id, body')
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw new Error(error.message);

    const items: TodayAlertItem[] = [];
    for (const row of (data ?? []) as unknown as AlertRow[]) {
      if (!isAgencyAlertKind(row.kind)) continue;
      const by = namesById.get(row.created_by) ?? 'un collègue';
      items.push({
        id: row.id,
        kind: row.kind,
        createdByName: by,
        headline: AGENCY_ALERT_LABELS[row.kind],
        context: `Signalé par ${by}`,
        contactId: row.contact_id,
        leadId: row.lead_id,
      });
    }
    return items;
  } catch (err) {
    console.error('[alerts] lecture impossible', err);
    return [];
  }
}
