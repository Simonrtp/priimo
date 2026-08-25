import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { viewerFromProfile } from '@/lib/agency/visibility';
import { visibleContactsFor, visibleLeadsFor } from '@/lib/agency/scope-records';
import { fetchMembersOfMyAgency, memberNamesById } from '@/lib/queries/agency-members';
import { fetchLeads } from '@/lib/queries/leads';
import { fetchContactsSafe, fetchVoiceNotesSafe } from '@/lib/queries/contacts';
import { fetchBiensSafe } from '@/lib/queries/biens';
import { fetchTodayDismissals } from '@/lib/queries/today';
import { fetchAssignmentsToMe } from '@/lib/queries/assignments';
import { fetchAgencyAlerts } from '@/lib/queries/alerts';
import { fetchAgencyOverview } from '@/lib/queries/agency-overview';
import { buildTodayCards } from '@/lib/today/cards';
import { fetchFieldWeek } from '@/lib/queries/field-week';
import { fetchTodayMetierSafe } from '@/lib/queries/metier-today';
import { centroidFromCoords } from '@/lib/today/quadrant';
import { rapprocherTousLesBiens } from '@/lib/matching/rapprochement';
import { bienIsActive } from '@/types/bien';
import { markServerTimingReady, timed } from '@/lib/perf/timing';
import TodayClient from '@/components/dashboard/today/TodayClient';
import AgencyOverviewBlock from '@/components/dashboard/today/AgencyOverviewBlock';
import {
  TodayDesktopSkeleton,
  TodayOverviewSkeleton,
} from '@/components/dashboard/today/TodaySkeletons';
import AujourdhuiMobile from '@/app/dashboard/_mobile/AujourdhuiMobile';
import { getDevice } from '@/lib/device-server';
import type { AgencyRow, ContextualProfile } from '@/types/database';
import type { ProfileAgencyMembership } from '@/lib/auth/active-agency';
import type { VoiceNote } from '@/types/contact';

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

  const [leads, contacts, biens, dismissals, members, metier, notes, device] = await Promise.all([
    timed('fetchLeads', () => fetchLeads(supabase)),
    timed('fetchContactsSafe', () => fetchContactsSafe(supabase)),
    timed('fetchBiensSafe', () => fetchBiensSafe(supabase)),
    timed('fetchTodayDismissals', () => fetchTodayDismissals(supabase, profile.id)),
    timed('fetchMembersOfMyAgency', () => fetchMembersOfMyAgency(agency.id, memberships)),
    timed('fetchTodayMetierSafe', () => fetchTodayMetierSafe(supabase, profile.id)),
    isDirector
      ? timed('fetchVoiceNotesSafe', () => fetchVoiceNotesSafe(supabase))
      : Promise.resolve([] as VoiceNote[]),
    timed('getDevice(page)', () => getDevice()),
  ]);

  const names = memberNamesById(members);
  const visibleContacts = visibleContactsFor(viewer, contacts);
  const visibleLeads = visibleLeadsFor(viewer, leads);

  const rapprochements = await timed('rapprocherTousLesBiens', async () =>
    rapprocherTousLesBiens(
      biens.filter((b) => bienIsActive(b.mandatStatut)).map((b) => ({
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

  markServerTimingReady();

  const overviewPrefetched = {
    members: members.map((m) => ({ id: m.id, fullName: m.fullName })),
    leads,
    contacts,
    biens,
    notes,
  };

  if (device === 'mobile') {
    return (
      <AujourdhuiMobile
        initialCards={cards}
        initialLeads={visibleLeads}
        profileId={profile.id}
        firstName={profile.first_name}
        week={week}
        sectorRef={centroidFromCoords(visibleLeads)}
      />
    );
  }

  return (
    <TodayClient
      initialCards={cards}
      initialLeads={visibleLeads}
      profileId={profile.id}
      firstName={profile.first_name}
      sectorCenter={centroidFromCoords(visibleLeads)}
      relancesProgrammees={week.relancesProgrammees}
      rapprochements={week.rapprochements}
    >
      {isDirector ? (
        <Suspense fallback={<TodayOverviewSkeleton />}>
          <DirectorOverview
            agencyId={agency.id}
            memberships={memberships}
            postalCodes={agency.codes_postaux ?? []}
            prefetched={overviewPrefetched}
          />
        </Suspense>
      ) : null}
    </TodayClient>
  );
}

async function DirectorOverview({
  agencyId,
  memberships,
  postalCodes,
  prefetched,
}: {
  agencyId: string;
  memberships: ProfileAgencyMembership[];
  postalCodes: string[];
  prefetched: NonNullable<Parameters<typeof fetchAgencyOverview>[0]['prefetched']>;
}) {
  const supabase = await createSupabaseServerClient();
  const overview = await timed('fetchAgencyOverview(interactions only)', () =>
    fetchAgencyOverview({
      supabase,
      agencyId,
      memberships,
      role: 'directeur',
      agencyPostalCodes: postalCodes,
      prefetched,
    }),
  );
  return (
    <div className="mt-8">
      <AgencyOverviewBlock overview={overview} defaultCollapsed />
    </div>
  );
}
