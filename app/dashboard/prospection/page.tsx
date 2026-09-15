import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { fetchLeads, fetchTeamMembers } from '@/lib/queries/leads';
import { fetchLeadStages } from '@/lib/queries/lead-stages';
import { viewerFromProfile } from '@/lib/agency/visibility';
import {
  visibleBiensFor,
  visibleContactsFor,
  visibleLeadsFor,
  visibleVoiceNotesFor,
} from '@/lib/agency/scope-records';
import { initializeLeadsLastSeenAt } from '@/lib/queries/profiles';
import {
  countLatestBatchLeads,
  shouldShowPipelineBanner,
} from '@/lib/lead-delivery';
import { resoudreProspectionVue } from '@/lib/prospection/vue';
import { fetchContactsSafe, fetchVoiceNotesSafe } from '@/lib/queries/contacts';
import { fetchBiensSafe } from '@/lib/queries/biens';
import { fetchMembersOfMyAgency } from '@/lib/queries/agency-members';
import { fetchZonesSafe } from '@/lib/queries/zones';
import { buildSectorMapPoints } from '@/lib/carte/points';
import { buildSortie } from '@/lib/today/sortie';
import { toItineraireStops } from '@/lib/today/directions';
import ProspectsClient from '@/components/dashboard/ProspectsClient';
import ProspectionCarteView from '@/components/dashboard/ProspectionCarteView';
import { fetchPassagesObserves } from '@/lib/queries/passages';
import {
  CYCLE_DEFAUT_JOURS,
  annoterAdresse,
  correspondFraicheur,
  cycleObserveJours,
  dernierPassageParAdresse,
  parseNiveauFraicheur,
} from '@/lib/zones/fraicheur';

export const metadata = {
  title: 'Prospection',
};

export default async function ProspectionPage({
  searchParams,
}: {
  searchParams: Promise<{
    lead?: string;
    filtre?: string;
    vue?: string;
    membre?: string;
    immeuble?: string;
    itineraire?: string;
    tournee?: string;
    fraicheur?: string;
    zone?: string;
  }>;
}) {
  const { user, profile, agency, memberships } = await getServerUser();
  if (!user || !profile || !agency) redirect('/login');

  const params = await searchParams;
  const vueRaw = params.vue;
  const fraicheurFiltre = parseNiveauFraicheur(params.fraicheur);
  const listFilter =
    params.filtre === 'sans-position' ||
    params.filtre === 'non-assignes-14j' ||
    params.filtre === 'non-pris' ||
    params.filtre === 'estimations'
      ? params.filtre
      : null;
  const vue = resoudreProspectionVue({
    vue: vueRaw,
    lead: params.lead,
    filtre: listFilter,
    fraicheur: fraicheurFiltre ? params.fraicheur : null,
  });

  const supabase = await createSupabaseServerClient();

  if (vue === 'carte') {
    const viewer = viewerFromProfile(profile);
    const [leads, contacts, biens, notes, members, stages, zones] = await Promise.all([
      fetchLeads(supabase),
      fetchContactsSafe(supabase),
      fetchBiensSafe(supabase),
      fetchVoiceNotesSafe(supabase),
      fetchMembersOfMyAgency(agency.id, memberships),
      fetchLeadStages(supabase),
      fetchZonesSafe(supabase),
    ]);
    const visibleLeads = visibleLeadsFor(viewer, leads);
    const passages =
      params.itineraire === '1' || fraicheurFiltre
        ? await fetchPassagesObserves({ supabase, stages })
        : [];
    const cycle = cycleObserveJours(
      passages,
      profile.id,
      agency.frequence_passage_jours ?? CYCLE_DEFAUT_JOURS,
    );
    const derniers = dernierPassageParAdresse(passages, profile.id);
    const maintenant = new Date();
    const leadsAnnotes = visibleLeads.map((l) => ({
      ...l,
      ...annoterAdresse({
        banId: l.banId,
        id: l.id,
        derniers,
        maintenant,
        cycleJours: cycle.jours,
      }),
    }));
    const leadsTournee = fraicheurFiltre
      ? leadsAnnotes.filter((l) => correspondFraicheur(l.fraicheur, fraicheurFiltre))
      : leadsAnnotes;
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
    const membersUi = members.map((m) => ({ id: m.id, fullName: m.fullName }));
    const plan = params.itineraire === '1' ? buildSortie(leadsTournee, profile.id, null) : null;
    const itineraryStops = plan ? toItineraireStops(plan.ordered) : null;

    return (
      <ProspectionCarteView
        points={points}
        withoutPosition={withoutPosition}
        unplaced={unplaced}
        agencyPostalCodes={agency.codes_postaux ?? []}
        center={{ latitude: agency.latitude, longitude: agency.longitude }}
        members={membersUi}
        isDirector={profile.role === 'directeur'}
        initialLeads={leadsAnnotes}
        profileId={profile.id}
        agencyOrigin={
          agency.latitude != null && agency.longitude != null
            ? { latitude: agency.latitude, longitude: agency.longitude }
            : null
        }
        initialBanId={params.immeuble ?? null}
        itineraryStops={itineraryStops}
        showItineraire={params.itineraire === '1'}
        autoTournee={params.tournee === '1' && profile.role !== 'directeur'}
        zones={zones}
        initialZoneId={params.zone ?? null}
      />
    );
  }

  const [leads, teamMembers, stages, zones] = await Promise.all([
    fetchLeads(supabase),
    fetchTeamMembers(supabase, agency.id),
    fetchLeadStages(supabase),
    fetchZonesSafe(supabase),
  ]);
  const viewer = viewerFromProfile(profile);
  const visibleLeads = visibleLeadsFor(viewer, leads);
  const passages = fraicheurFiltre
    ? await fetchPassagesObserves({ supabase, stages })
    : [];
  const cycle = cycleObserveJours(
    passages,
    profile.id,
    agency.frequence_passage_jours ?? CYCLE_DEFAUT_JOURS,
  );
  const derniers = dernierPassageParAdresse(passages, profile.id);
  const maintenant = new Date();
  const leadsAnnotes = visibleLeads.map((l) => ({
    ...l,
    ...annoterAdresse({
      banId: l.banId,
      id: l.id,
      derniers,
      maintenant,
      cycleJours: cycle.jours,
    }),
  }));

  const storedLastSeen = profile.leads_last_seen_at ?? null;
  let showPipelineBanner = false;

  if (storedLastSeen === null) {
    await initializeLeadsLastSeenAt(supabase, profile.id);
  } else {
    showPipelineBanner = shouldShowPipelineBanner(visibleLeads, storedLastSeen);
  }

  const newBatchCount = countLatestBatchLeads(visibleLeads);
  const selectedLeadId =
    params.lead && visibleLeads.some((l) => l.id === params.lead) ? params.lead : null;

  return (
    <ProspectsClient
      initialLeads={leadsAnnotes}
      teamMembers={teamMembers}
      stages={stages}
      isDirector={profile.role === 'directeur'}
      initialShowPipelineBanner={showPipelineBanner}
      initialNewBatchCount={newBatchCount}
      initialSelectedLeadId={selectedLeadId}
      listFilter={listFilter}
      memberId={params.membre ?? null}
      initialVue={vue}
      zones={zones}
      fraicheurFilter={fraicheurFiltre}
    />
  );
}
