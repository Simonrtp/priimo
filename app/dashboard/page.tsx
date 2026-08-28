import { Suspense } from 'react';
import { cookies } from 'next/headers';
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
import { parseAccueilVue, ACCUEIL_VUE_COOKIE } from '@/lib/today/accueil-vue';
import { homeNoteAttachment, recentNotesForHome } from '@/lib/notes/inbox';
import { mondayOf, previousMonday, toPreviousWeek } from '@/lib/today/weekly-snapshot';
import { fetchWeeklySnapshot, upsertWeeklySnapshot } from '@/lib/queries/weekly-snapshots';
import { ymdKey, startOfWeekYmd } from '@/lib/today/calendar';
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
  const cookieStore = await cookies();
  const previewingAgent =
    profile.role === 'directeur' &&
    parseAccueilVue(cookieStore.get(ACCUEIL_VUE_COOKIE)?.value) === 'agent';
  const layoutDirector = profile.role === 'directeur' && !previewingAgent;
  const viewer = viewerFromProfile(
    previewingAgent ? { ...profile, role: 'collaborateur' } : profile,
  );
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

  const prevSnap = await fetchWeeklySnapshot(supabase, agency.id, previousMonday());
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
    previousWeek: toPreviousWeek(prevSnap),
  });

  if (isDirector && !previewingAgent) {
    const byKind = Object.fromEntries(portfolio.counters.map((c) => [c.kind, c]));
    void upsertWeeklySnapshot(supabase, agency.id, {
      weekStart: mondayOf(),
      mandatsActifs: byKind['mandats-actifs']?.value ?? 0,
      leadsNonPris: byKind['leads-non-pris']?.value ?? 0,
      rdvSansSuite: byKind['rdv-sans-suite']?.value ?? byKind['estimations']?.value ?? 0,
      mandats60j: byKind['mandats-60j']?.value ?? 0,
    });
  }

  const contactsById = new Map(visibleContacts.map((c) => [c.id, c.fullName]));
  const recentNotes = recentNotesForHome(visibleNotes, {
    viewerId: profile.id,
    isDirector: layoutDirector,
    limit: 5,
    weekStartKey: ymdKey(startOfWeekYmd(new Date())),
  }).map((note) => ({
    ...note,
    attachmentLabel: homeNoteAttachment(
      note,
      note.contactId ? contactsById.get(note.contactId) ?? null : null,
    ),
  }));

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

  const [assignments, alerts, week, demandesPortail, demandesEstimation, estimationsVuees] =
    await Promise.all([
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
    timed('fetchDemandesPortail', async () => {
      try {
        const since = new Date();
        since.setDate(since.getDate() - 3);
        const { data } = await supabase
          .from('leads_portail')
          .select('id, nom, telephone, contact_id, bien_id, portail, created_at, biens(address)')
          .eq('agency_id', agency.id)
          .gte('created_at', since.toISOString())
          .in('statut', ['importe', 'a_traiter_main'])
          .order('created_at', { ascending: false })
          .limit(20);
        return (data ?? []).map((row) => {
          const bien = row.biens as { address?: string } | { address?: string }[] | null;
          const adresse = Array.isArray(bien) ? bien[0]?.address : bien?.address;
          return {
            id: row.id as string,
            nom: (row.nom as string | null) ?? null,
            telephone: (row.telephone as string | null) ?? null,
            contactId: (row.contact_id as string | null) ?? null,
            bienId: (row.bien_id as string | null) ?? null,
            bienAdresse: adresse ?? null,
            portail: (row.portail as string) ?? 'portail',
            createdAt: row.created_at as string,
          };
        });
      } catch {
        return [];
      }
    }),
    timed('fetchDemandesEstimation', async () => {
      // Demandes abouties sur le site de l'agence (widget). Sept jours : au-delà,
      // le rappel n'est plus une urgence du jour mais une relance ordinaire.
      try {
        const since = new Date();
        since.setDate(since.getDate() - 7);
        const { data } = await supabase
          .from('estimation_requests')
          .select(
            'id, first_name, last_name, phone, contact_id, address, estimation_value, estimation_low, estimation_high, created_at, assigned_to',
          )
          .eq('agency_id', agency.id)
          .eq('consent_given', true)
          .eq('status', 'nouveau')
          .gte('created_at', since.toISOString())
          .order('created_at', { ascending: false })
          .limit(20);

        return (data ?? [])
          .filter((row) => {
            // Un collaborateur ne voit que ce qui lui revient ; le directeur voit tout.
            const assignedTo = row.assigned_to as string | null;
            return isDirector || !assignedTo || assignedTo === profile.id;
          })
          .map((row) => ({
            id: row.id as string,
            nom:
              [row.first_name as string | null, row.last_name as string | null]
                .filter(Boolean)
                .join(' ')
                .trim() || 'Demande d’estimation',
            telephone: (row.phone as string | null) ?? null,
            contactId: (row.contact_id as string | null) ?? null,
            address: (row.address as string | null) ?? '',
            valeur: (row.estimation_value as number | null) ?? null,
            low: (row.estimation_low as number | null) ?? null,
            high: (row.estimation_high as number | null) ?? null,
            createdAt: row.created_at as string,
          }));
      } catch {
        return [];
      }
    }),
    timed('fetchEstimationsVuees', async () => {
      try {
        const since = new Date();
        since.setDate(since.getDate() - 14);
        const { data } = await supabase
          .from('agency_estimations')
          .select('id, address, view_count, last_viewed_at, price_low, price_high')
          .eq('agency_id', agency.id)
          .gt('view_count', 0)
          .not('last_viewed_at', 'is', null)
          .gte('last_viewed_at', since.toISOString())
          .is('share_revoked_at', null)
          .order('last_viewed_at', { ascending: false })
          .limit(15);
        return (data ?? []).map((row) => ({
          id: row.id as string,
          address: (row.address as string) ?? '',
          viewCount: (row.view_count as number) ?? 0,
          lastViewedAt: (row.last_viewed_at as string) ?? '',
          priceLow: (row.price_low as number | null) ?? null,
          priceHigh: (row.price_high as number | null) ?? null,
        }));
      } catch {
        return [];
      }
    }),
  ]);

  const cards = buildTodayCards({
    leads: visibleLeads,
    contacts: visibleContacts,
    rapprochements,
    dismissals,
    assignments,
    alerts,
    demandesPortail,
    demandesEstimation,
    estimationsVuees,
    ...metier,
  });

  let directorExceptions: ReturnType<typeof buildDirectorExceptions> = [];
  if (layoutDirector) {
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
    previewingAgent,
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
