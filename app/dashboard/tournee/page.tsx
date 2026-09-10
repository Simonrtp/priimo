import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { getDevice } from '@/lib/device-server';
import { viewerFromProfile } from '@/lib/agency/visibility';
import { visibleLeadsFor } from '@/lib/agency/scope-records';
import { fetchLeads } from '@/lib/queries/leads';
import { toGeoCoord } from '@/lib/carte/coords';
import { fetchZonesSafe } from '@/lib/queries/zones';
import { leadsDuJour, libelleModeDuJour, modeDuJour } from '@/lib/zones/jour';
import TourneeMobile from '@/app/dashboard/_mobile/TourneeMobile';

export const metadata = {
  title: 'Tournée',
};

export default async function TourneePage() {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) redirect('/login');

  // Directeur : pas de sortie ni tournée sur mobile
  if (profile.role === 'directeur') redirect('/dashboard');

  const device = await getDevice();
  if (device !== 'mobile') redirect('/dashboard');

  const supabase = await createSupabaseServerClient();
  const [leads, zones] = await Promise.all([fetchLeads(supabase), fetchZonesSafe(supabase)]);
  const viewer = viewerFromProfile(profile);
  const visibleLeads = visibleLeadsFor(viewer, leads);
  const agencyOrigin = toGeoCoord(agency.latitude, agency.longitude);

  // Si un secteur est prévu aujourd'hui, la tournée s'y tient : traverser la
  // ville entre deux portes n'est pas une tournée. Sans calendrier de
  // secteurs, rien ne change.
  const duJour = modeDuJour(zones, profile.id, new Date());
  const leadsTournee = leadsDuJour(visibleLeads, zones, profile.id);

  return (
    <TourneeMobile
      initialLeads={leadsTournee}
      profileId={profile.id}
      agencyOrigin={agencyOrigin}
      bandeauZone={libelleModeDuJour(duJour)}
    />
  );
}
