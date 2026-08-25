import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { viewerFromProfile } from '@/lib/agency/visibility';
import { visibleContactsFor, visibleLeadsFor } from '@/lib/agency/scope-records';
import { fetchMembersOfMyAgency, memberNamesById } from '@/lib/queries/agency-members';
import { fetchLeads } from '@/lib/queries/leads';
import { fetchContactsSafe } from '@/lib/queries/contacts';
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
import TodayClient from '@/components/dashboard/today/TodayClient';
import AujourdhuiMobile from '@/app/dashboard/_mobile/AujourdhuiMobile';
import { getDevice } from '@/lib/device-server';

export const dynamic = 'force-dynamic';

export default async function TodayPage() {
  const { user, profile, agency, memberships } = await getServerUser();
  if (!user || !profile || !agency) redirect('/login');

  const supabase = await createSupabaseServerClient();
  const viewer = viewerFromProfile(profile);

  const [leads, contacts, biens, dismissals, members] = await Promise.all([
    fetchLeads(supabase),
    fetchContactsSafe(supabase),
    fetchBiensSafe(supabase),
    fetchTodayDismissals(supabase, profile.id),
    fetchMembersOfMyAgency(agency.id, memberships),
  ]);

  const names = memberNamesById(members);
  const visibleContacts = visibleContactsFor(viewer, contacts);
  const visibleLeads = visibleLeadsFor(viewer, leads);

  const [assignments, alerts, agencyOverview] = await Promise.all([
    fetchAssignmentsToMe(supabase, profile.id, names),
    profile.role === 'directeur' ? fetchAgencyAlerts(supabase, names) : Promise.resolve([]),
    profile.role === 'directeur'
      ? fetchAgencyOverview({
          supabase,
          agencyId: agency.id,
          memberships,
          role: profile.role,
          agencyPostalCodes: agency.codes_postaux ?? [],
        })
      : Promise.resolve(null),
  ]);

  const rapprochements = rapprocherTousLesBiens(
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
  );

  const cards = buildTodayCards({
    leads: visibleLeads,
    contacts: visibleContacts,
    rapprochements,
    dismissals,
    assignments,
    alerts,
    ...(await fetchTodayMetierSafe(supabase, profile.id)),
  });
  const device = await getDevice();

  if (device === 'mobile') {
    const week = await fetchFieldWeek({
      supabase,
      profileId: profile.id,
      contacts: visibleContacts,
      leads: visibleLeads,
    });
    const sectorRef = centroidFromCoords(visibleLeads);
    return (
      <AujourdhuiMobile
        initialCards={cards}
        initialLeads={visibleLeads}
        profileId={profile.id}
        firstName={profile.first_name}
        week={week}
        sectorRef={sectorRef}
      />
    );
  }

  const week = await fetchFieldWeek({
    supabase,
    profileId: profile.id,
    contacts: visibleContacts,
    leads: visibleLeads,
  });

  return (
    <TodayClient
      initialCards={cards}
      initialLeads={visibleLeads}
      profileId={profile.id}
      firstName={profile.first_name}
      sectorCenter={centroidFromCoords(visibleLeads)}
      agencyOverview={agencyOverview}
      relancesProgrammees={week.relancesProgrammees}
      rapprochements={week.rapprochements}
    />
  );
}
