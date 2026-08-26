import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { viewerFromProfile } from '@/lib/agency/visibility';
import {
  visibleBiensFor,
  visibleContactsFor,
  visibleLeadsFor,
  visibleVoiceNotesFor,
} from '@/lib/agency/scope-records';
import { fetchMembersOfMyAgency, memberNamesById } from '@/lib/queries/agency-members';
import { fetchLeads } from '@/lib/queries/leads';
import { fetchContactsSafe, fetchVoiceNotesSafe } from '@/lib/queries/contacts';
import { fetchBiensSafe } from '@/lib/queries/biens';
import { fetchTodayDismissals } from '@/lib/queries/today';
import { fetchAssignmentsToMe } from '@/lib/queries/assignments';
import { fetchAgencyAlerts } from '@/lib/queries/alerts';
import { fetchTodayMetierSafe, fetchVisitCountByBienIdSafe } from '@/lib/queries/metier-today';
import { fetchLeadStages } from '@/lib/queries/lead-stages';
import {
  countSansSuite,
  fetchPastRendezVousSafe,
} from '@/lib/queries/rendez-vous-sans-suite';
import { fetchFieldWeek } from '@/lib/queries/field-week';
import { buildTodayCards } from '@/lib/today/cards';
import { buildPortfolioStats } from '@/lib/today/portfolio';
import { buildDirectorExceptions } from '@/lib/today/director-exceptions';
import { recentNotesForHome } from '@/lib/notes/inbox';
import { centroidFromCoords } from '@/lib/today/quadrant';
import { toGeoCoord } from '@/lib/carte/coords';
import { rapprocherTousLesBiens } from '@/lib/matching/rapprochement';
import { bienIsActive } from '@/types/bien';
import { markServerTimingReady, timed } from '@/lib/perf/timing';
import TodayClient from '@/components/dashboard/today/TodayClient';
import { TodayDesktopSkeleton } from '@/components/dashboard/today/TodaySkeletons';
import AujourdhuiMobile from '@/app/dashboard/_mobile/AujourdhuiMobile';
import { getDevice } from '@/lib/device-server';
import type { AgencyRow, ContextualProfile } from '@/types/database';
import type { ProfileAgencyMembership } from '@/lib/auth/active-agency';
import { fetchAgencyOverview } from '@/lib/queries/agency-overview';

export const dynamic = 'force-dynamic';

export default async function TodayPage() {
  const { user, profile, agency, memberships } = await getServerUser();
  if (!user || !profile || !agency) redirect('/login');

  return (
    <Suspense fallback={<TodayDesktopSkeleton />}>
      <TodayContent profile={profile} agency={agency} memberships={memberships} />
    </Suspense>
  );
}

async function TodayContent({
  profile,
  agency,
  memberships,
}: {
  profile: ContextualProfile;
  agency: AgencyRow;
  memberships: ProfileAgencyMembership[];
}) {
  const supabase = await createSupabaseServerClient();
  const viewer = viewerFromProfile(profile);
  const isDirector = profile.role === 'directeur';

  const [leads, contacts, biens, dismissals, members, metier, notes, device, stages, pastRdv, visitCounts] =
    await Promise.all([
      timed('fetchLeads', () => fetchLeads(supabase)),
      timed('fetchContactsSafe', () => fetchContactsSafe(supabase)),
      timed('fetchBiensSafe', () => fetchBiensSafe(supabase)),
      timed('fetchTodayDismissals', () => fetchTodayDismissals(supabase, profile.id)),
      timed('fetchMembersOfMyAgency', () => fetchMembersOfMyAgency(agency.id, memberships)),
      timed('fetchTodayMetierSafe', () => fetchTodayMetierSafe(supabase, profile.id)),
      timed('fetchVoiceNotesSafe', () => fetchVoiceNotesSafe(supabase)),
      timed('getDevice(page)', () => getDevice()),
      timed('fetchLeadStages', () => fetchLeadStages(supabase)),
      timed('fetchPastRendezVousSafe', () => fetchPastRendezVousSafe(supabase)),
      timed('fetchVisitCountByBienIdSafe', () => fetchVisitCountByBienIdSafe(supabase)),
    ]);

  const names = memberNamesById(members);
  const visibleContacts = visibleContactsFor(viewer, contacts);
  const visibleLeads = visibleLeadsFor(viewer, leads);
  const visibleBiens = visibleBiensFor(viewer, biens);
  const visibleNotes = visibleVoiceNotesFor(viewer, notes);

  const lastInteractionByContactId: Record<string, string | null> = {};
  for (const c of visibleContacts) {
    lastInteractionByContactId[c.id] = c.lastInteractionAt;
  }
  const rendezVousSansSuite = countSansSuite(pastRdv, lastInteractionByContactId);
  const estimationStageId = stages.find((s) => s.cle === 'estimation')?.id ?? null;

  const visitCountByBienId: Record<string, number> = { ...visitCounts };
  for (const b of metier.biens) visitCountByBienId[b.id] = b.visitCount;

  const portfolio = buildPortfolioStats({
    biens: visibleBiens.map((b) => ({
      id: b.id,
      mandatStatut: b.mandatStatut,
      mandatDate: b.mandatDate,
      createdAt: b.createdAt,
    })),
    visitCountByBienId,
    leads: visibleLeads.map((l) => ({ stageId: l.stageId })),
    estimationStageId,
    rendezVousSansSuite,
  });

  const recentNotes = recentNotesForHome(visibleNotes, {
    viewerId: profile.id,
    isDirector,
    limit: 5,
  });

  const agencyOrigin = toGeoCoord(agency.latitude, agency.longitude);

  const rapprochements = await timed('rapprocherTousLesBiens', async () =>
    rapprocherTousLesBiens(
      visibleBiens
        .filter((b) => bienIsActive(b.mandatStatut))
        .map((b) => ({
          id: b.id,
          address: b.address,
          postalCode: b.postalCode,
          price: b.price,
          surfaceM2: b.surfaceM2,
          rooms: b.rooms,
          latitude: b.latitude,
          longitude: b.longitude,
        })),
      visibleContacts,
    ),
  );

  const [assignments, alerts, week] = await Promise.all([
    timed('fetchAssignmentsToMe', () => fetchAssignmentsToMe(supabase, profile.id, names)),
    isDirector
      ? timed('fetchAgencyAlerts', () => fetchAgencyAlerts(supabase, names))
      : Promise.resolve([]),
    timed('fetchFieldWeek', () =>
      fetchFieldWeek({
        supabase,
        profileId: profile.id,
        contacts: visibleContacts,
        leads: visibleLeads,
      }),
    ),
  ]);

  const cards = buildTodayCards({
    leads: visibleLeads,
    contacts: visibleContacts,
    rapprochements,
    dismissals,
    assignments,
    alerts,
    ...metier,
  });

  let directorExceptions: ReturnType<typeof buildDirectorExceptions> = [];
  if (isDirector) {
    const overview = await timed('fetchAgencyOverview(interactions only)', () =>
      fetchAgencyOverview({
        supabase,
        agencyId: agency.id,
        memberships,
        role: 'directeur',
        agencyPostalCodes: agency.codes_postaux ?? [],
        prefetched: {
          members: members.map((m) => ({ id: m.id, fullName: m.fullName })),
          leads,
          contacts,
          biens,
          notes: visibleNotes,
        },
      }),
    );
    const volumeById: Record<string, number> = {};
    for (const row of overview.activity) volumeById[row.memberId] = row.volume;
    directorExceptions = buildDirectorExceptions({
      members: members.map((m) => ({ id: m.id, fullName: m.fullName })),
      leads: visibleLeads.map((l) => ({ assignedTo: l.assignedTo, stageId: l.stageId })),
      notes: visibleNotes.map((n) => ({ createdBy: n.createdBy, statut: n.statut })),
      biens: visibleBiens.map((b) => ({
        id: b.id,
        createdBy: b.createdBy,
        mandatStatut: b.mandatStatut,
        mandatDate: b.mandatDate,
        createdAt: b.createdAt,
      })),
      visitCountByBienId,
      activityVolumeByMemberId: volumeById,
    });
  }

  markServerTimingReady();

  const homeProps = {
    initialCards: cards,
    initialLeads: visibleLeads,
    profileId: profile.id,
    firstName: profile.first_name,
    portfolio,
    recentNotes,
    agencyOrigin,
    isDirector,
    directorExceptions,
  };

  if (device === 'mobile') {
    return (
      <AujourdhuiMobile
        {...homeProps}
        week={week}
        sectorRef={centroidFromCoords(visibleLeads)}
      />
    );
  }

  return (
    <TodayClient
      {...homeProps}
      relancesProgrammees={week.relancesProgrammees}
      rapprochements={week.rapprochements}
    />
  );
}
