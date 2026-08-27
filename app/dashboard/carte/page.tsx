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
import { fetchLeads } from '@/lib/queries/leads';
import { fetchContactsSafe, fetchVoiceNotesSafe } from '@/lib/queries/contacts';
import { fetchBiensSafe } from '@/lib/queries/biens';
import { fetchMembersOfMyAgency } from '@/lib/queries/agency-members';
import { buildSectorMapPoints } from '@/lib/carte/points';
import { buildSortie } from '@/lib/today/sortie';
import { toItineraireStops } from '@/lib/today/directions';
import SectorMapClient from '@/components/dashboard/carte/SectorMapClient';
import CarteMobile from '@/app/dashboard/_mobile/CarteMobile';
import { getDevice } from '@/lib/device-server';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Carte',
};

export default async function CartePage({
  searchParams,
}: {
  searchParams: Promise<{ immeuble?: string; itineraire?: string; tournee?: string }>;
}) {
  const { user, profile, agency, memberships } = await getServerUser();
  if (!user || !profile || !agency) redirect('/login');

  const supabase = await createSupabaseServerClient();
  const viewer = viewerFromProfile(profile);
  const [leads, contacts, biens, notes, members, device, params] = await Promise.all([
    fetchLeads(supabase),
    fetchContactsSafe(supabase),
    fetchBiensSafe(supabase),
    fetchVoiceNotesSafe(supabase),
    fetchMembersOfMyAgency(agency.id, memberships),
    getDevice(),
    searchParams,
  ]);

  const visibleLeads = visibleLeadsFor(viewer, leads);
  const { points, withoutPosition, unplaced } = buildSectorMapPoints({
    agencyId: agency.id,
    leads: visibleLeads,
    contacts: visibleContactsFor(viewer, contacts).map((c) => ({
      ...c,
      postalCodes: c.criteria.postalCodes,
    })),
    biens: visibleBiensFor(viewer, biens),
    notes: visibleVoiceNotesFor(viewer, notes),
  });

  const { immeuble, itineraire, tournee } = params;
  const membersUi = members.map((m) => ({ id: m.id, fullName: m.fullName }));
  const plan = itineraire === '1' ? buildSortie(visibleLeads, profile.id, null) : null;
  const itineraryStops = plan ? toItineraireStops(plan.ordered) : null;

  if (device === 'mobile') {
    return (
      <CarteMobile
        points={points}
        withoutPosition={withoutPosition}
        unplaced={unplaced}
        agencyPostalCodes={agency.codes_postaux ?? []}
        center={{ latitude: agency.latitude, longitude: agency.longitude }}
        members={membersUi}
        isDirector={profile.role === 'directeur'}
        initialLeads={visibleLeads}
        profileId={profile.id}
        agencyOrigin={
          agency.latitude != null && agency.longitude != null
            ? { latitude: agency.latitude, longitude: agency.longitude }
            : null
        }
        initialBanId={immeuble ?? null}
        itineraryStops={itineraryStops}
        showItineraire={itineraire === '1'}
        autoTournee={tournee === '1' && profile.role !== 'directeur'}
      />
    );
  }

  return (
    <SectorMapClient
      points={points}
      withoutPosition={withoutPosition}
      unplaced={unplaced}
      agencyPostalCodes={agency.codes_postaux ?? []}
      center={{ latitude: agency.latitude, longitude: agency.longitude }}
      members={membersUi}
      isDirector={profile.role === 'directeur'}
      initialBanId={immeuble ?? null}
      itineraryStops={itineraryStops}
      showItineraire={itineraire === '1'}
    />
  );
}
