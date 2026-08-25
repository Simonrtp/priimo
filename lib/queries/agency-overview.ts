import type { SupabaseClient } from '@supabase/supabase-js';
import { assertAgencyScope, fetchMembersOfMyAgency } from '@/lib/queries/agency-members';
import { fetchBiensSafe } from '@/lib/queries/biens';
import { fetchContactsSafe, fetchVoiceNotesSafe } from '@/lib/queries/contacts';
import { fetchLeads } from '@/lib/queries/leads';
import {
  AGENCY_OVERVIEW,
  buildAgencyOverview,
  type AgencyOverview,
  type OverviewInteraction,
  type OverviewLocated,
} from '@/lib/today/agency-overview';
import type { Database } from '@/types/database';
import type { Bien } from '@/types/bien';
import type { Contact, VoiceNote } from '@/types/contact';
import type { Lead } from '@/types/lead';

type Client = SupabaseClient<Database>;

export class AgencyOverviewForbiddenError extends Error {
  constructor() {
    super('Réservé au directeur');
    this.name = 'AgencyOverviewForbiddenError';
  }
}

function locatedFromSources({
  leads,
  contacts,
  biens,
  notes,
}: {
  leads: readonly { banId: string | null; postalCode: string | null; createdAt: string; deliveredAt: string | null }[];
  contacts: readonly {
    banId: string | null;
    criteria: { postalCodes: string[] };
    lastInteractionAt: string | null;
    createdAt: string;
  }[];
  biens: readonly { banId: string | null; postalCode: string | null; updatedAt: string }[];
  notes: readonly { banId: string | null; postalCode: string | null; createdAt: string }[];
}): OverviewLocated[] {
  const located: OverviewLocated[] = [];
  for (const lead of leads) {
    located.push({
      banId: lead.banId,
      postalCode: lead.postalCode,
      occurredAt: lead.deliveredAt ?? lead.createdAt,
    });
  }
  for (const contact of contacts) {
    located.push({
      banId: contact.banId,
      postalCode: contact.criteria.postalCodes.find((c) => /^\d{5}$/.test(c)) ?? null,
      occurredAt: contact.lastInteractionAt ?? contact.createdAt,
    });
  }
  for (const bien of biens) {
    located.push({
      banId: bien.banId,
      postalCode: bien.postalCode,
      occurredAt: bien.updatedAt,
    });
  }
  for (const note of notes) {
    located.push({
      banId: note.banId,
      postalCode: note.postalCode,
      occurredAt: note.createdAt,
    });
  }
  return located;
}

export type AgencyOverviewPrefetched = {
  members: readonly { id: string; fullName: string }[];
  leads: readonly Lead[];
  contacts: readonly Contact[];
  biens: readonly Bien[];
  notes: readonly Pick<VoiceNote, 'createdBy' | 'createdAt' | 'banId' | 'postalCode'>[];
};

export async function fetchAgencyOverview({
  supabase,
  agencyId,
  memberships,
  role,
  agencyPostalCodes,
  now = Date.now(),
  prefetched,
}: {
  supabase: Client;
  agencyId: string;
  memberships: readonly { agency_id: string }[];
  role: 'directeur' | 'collaborateur';
  agencyPostalCodes: readonly string[];
  now?: number;
  prefetched?: AgencyOverviewPrefetched;
}): Promise<AgencyOverview> {
  if (role !== 'directeur') throw new AgencyOverviewForbiddenError();
  assertAgencyScope(memberships, agencyId);

  const [members, leads, contacts, biens, notes] = prefetched
    ? [
        prefetched.members,
        prefetched.leads,
        prefetched.contacts,
        prefetched.biens,
        prefetched.notes,
      ]
    : await Promise.all([
        fetchMembersOfMyAgency(agencyId, memberships).then((list) =>
          list.map((m) => ({ id: m.id, fullName: m.fullName })),
        ),
        fetchLeads(supabase),
        fetchContactsSafe(supabase),
        fetchBiensSafe(supabase),
        fetchVoiceNotesSafe(supabase),
      ]);

  const since = new Date(now - AGENCY_OVERVIEW.activityDays * 86_400_000).toISOString();
  const interactionsRes = await supabase
    .from('contact_interactions')
    .select('author_id, occurred_at')
    .eq('agency_id', agencyId)
    .gte('occurred_at', since);

  const interactions: OverviewInteraction[] = (interactionsRes.data ?? []).map((row) => ({
    authorId: row.author_id,
    occurredAt: row.occurred_at,
  }));

  return buildAgencyOverview({
    members: members.map((m) => ({ id: m.id, fullName: m.fullName })),
    notes: notes.map((n) => ({ createdBy: n.createdBy, createdAt: n.createdAt })),
    contacts,
    interactions,
    biens,
    leads,
    located: locatedFromSources({ leads, contacts, biens, notes }),
    agencyPostalCodes,
    now,
  });
}
