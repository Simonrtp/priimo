import { bienIsActive, type Bien } from '@/types/bien';
import type { Contact } from '@/types/contact';
import type { Lead } from '@/types/lead';

export const AGENCY_OVERVIEW = {
  activityDays: 7,
  staleSectorDays: 60,
  unassignedLeadDays: 14,
  silentVendeurDays: 45,
  staleMandatDays: 30,
} as const;

const DAY_MS = 86_400_000;

export type OverviewMember = {
  id: string;
  fullName: string;
};

export type OverviewVoiceNote = {
  createdBy: string | null;
  createdAt: string;
};

export type OverviewInteraction = {
  authorId: string | null;
  occurredAt: string;
};

export type OverviewLocated = {
  banId: string | null;
  postalCode: string | null;
  occurredAt: string;
};

export type MemberActivityRow = {
  memberId: string;
  fullName: string;
  voiceNotes: number;
  contacts: number;
  interactions: number;
  volume: number;
};

export type SectorCoverageRow = {
  postalCode: string;
  buildingCount: number;
  lastActivityAt: string | null;
  stale: boolean;
};

export type SleepingCounts = {
  unassignedLeads: number;
  silentVendeurs: number;
  staleMandats: number;
};

export type AgencyOverview = {
  activity: MemberActivityRow[];
  coverage: SectorCoverageRow[];
  sleeping: SleepingCounts;
};

function ageDays(iso: string | null | undefined, now: number): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return (now - t) / DAY_MS;
}

function inLastDays(iso: string | null | undefined, days: number, now: number): boolean {
  const age = ageDays(iso, now);
  return age !== null && age <= days;
}

export function buildMemberActivity(
  members: readonly OverviewMember[],
  notes: readonly OverviewVoiceNote[],
  contacts: readonly Pick<Contact, 'createdBy' | 'createdAt'>[],
  interactions: readonly OverviewInteraction[],
  now: number,
): MemberActivityRow[] {
  const days = AGENCY_OVERVIEW.activityDays;
  const rows = members.map((member) => {
    const voiceNotes = notes.filter(
      (n) => n.createdBy === member.id && inLastDays(n.createdAt, days, now),
    ).length;
    const createdContacts = contacts.filter(
      (c) => c.createdBy === member.id && inLastDays(c.createdAt, days, now),
    ).length;
    const createdInteractions = interactions.filter(
      (i) => i.authorId === member.id && inLastDays(i.occurredAt, days, now),
    ).length;
    return {
      memberId: member.id,
      fullName: member.fullName,
      voiceNotes,
      contacts: createdContacts,
      interactions: createdInteractions,
      volume: voiceNotes + createdContacts + createdInteractions,
    };
  });

  return rows.sort((a, b) => {
    if (b.volume !== a.volume) return b.volume - a.volume;
    return a.fullName.localeCompare(b.fullName, 'fr');
  });
}

export function buildSectorCoverage(
  agencyPostalCodes: readonly string[],
  located: readonly OverviewLocated[],
  now: number,
): SectorCoverageRow[] {
  const codes = [
    ...new Set(
      agencyPostalCodes.map((c) => c.trim()).filter((c) => /^\d{5}$/.test(c)),
    ),
  ].sort();

  return codes.map((postalCode) => {
    const inSector = located.filter((row) => row.banId && row.postalCode === postalCode);
    const banIds = new Set(inSector.map((row) => row.banId as string));
    let last = 0;
    for (const row of inSector) {
      const t = Date.parse(row.occurredAt);
      if (Number.isFinite(t) && t > last) last = t;
    }
    const lastActivityAt = last > 0 ? new Date(last).toISOString() : null;
    const stale =
      lastActivityAt === null ||
      (now - last) / DAY_MS > AGENCY_OVERVIEW.staleSectorDays;
    return {
      postalCode,
      buildingCount: banIds.size,
      lastActivityAt,
      stale,
    };
  });
}

export function countSleeping(
  leads: readonly Pick<Lead, 'assignedTo' | 'deliveredAt' | 'createdAt'>[],
  contacts: readonly Pick<Contact, 'type' | 'lastInteractionAt' | 'createdAt'>[],
  biens: readonly Pick<Bien, 'mandatStatut' | 'updatedAt'>[],
  now: number,
): SleepingCounts {
  const unassignedLeads = leads.filter((lead) => {
    if (lead.assignedTo) return false;
    const age = ageDays(lead.deliveredAt ?? lead.createdAt, now);
    return age !== null && age > AGENCY_OVERVIEW.unassignedLeadDays;
  }).length;

  const silentVendeurs = contacts.filter((contact) => {
    if (contact.type !== 'vendeur') return false;
    const age = ageDays(contact.lastInteractionAt ?? contact.createdAt, now);
    return age !== null && age > AGENCY_OVERVIEW.silentVendeurDays;
  }).length;

  const staleMandats = biens.filter((bien) => {
    if (!bienIsActive(bien.mandatStatut)) return false;
    const age = ageDays(bien.updatedAt, now);
    return age !== null && age > AGENCY_OVERVIEW.staleMandatDays;
  }).length;

  return { unassignedLeads, silentVendeurs, staleMandats };
}

export function buildAgencyOverview({
  members,
  notes,
  contacts,
  interactions,
  biens,
  leads,
  located,
  agencyPostalCodes,
  now,
}: {
  members: readonly OverviewMember[];
  notes: readonly OverviewVoiceNote[];
  contacts: readonly Contact[];
  interactions: readonly OverviewInteraction[];
  biens: readonly Bien[];
  leads: readonly Lead[];
  located: readonly OverviewLocated[];
  agencyPostalCodes: readonly string[];
  now: number;
}): AgencyOverview {
  return {
    activity: buildMemberActivity(members, notes, contacts, interactions, now),
    coverage: buildSectorCoverage(agencyPostalCodes, located, now),
    sleeping: countSleeping(leads, contacts, biens, now),
  };
}
