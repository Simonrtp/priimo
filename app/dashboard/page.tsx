import { Suspense } from 'react';
import { after } from 'next/server';
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
import { listerActionsOuvertes } from '@/lib/queries/actions';
import { fetchAssignmentsToMe } from '@/lib/queries/assignments';
import { fetchAgencyAlerts } from '@/lib/queries/alerts';
import { fetchTodayMetierSafe } from '@/lib/queries/metier-today';
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
import { homeNoteAttachment, homeNoteLieuKind, homeNoteTitre, recentNotesForHome } from '@/lib/notes/inbox';
import { auteurNote, portraitsParId, portraitsParNom, portraitPourNom } from '@/lib/notes/auteur';
import { rattachementsDesNotes } from '@/lib/queries/note-rattachements';
import { mondayOf, previousMonday, toPreviousWeek } from '@/lib/today/weekly-snapshot';
import { fetchWeeklySnapshot, upsertWeeklySnapshot } from '@/lib/queries/weekly-snapshots';
import { ymdKey, startOfWeekYmd } from '@/lib/today/calendar';
import { centroidFromCoords } from '@/lib/today/quadrant';
import { toGeoCoord } from '@/lib/carte/coords';
import { rapprocherTousLesBiens } from '@/lib/matching/rapprochement';
import { bienIsActive } from '@/types/bien';
import { markServerTimingReady, timed } from '@/lib/perf/timing';
import TodayClient from '@/components/dashboard/today/TodayClient';
import AccueilAmorce from '@/components/dashboard/accueil/AccueilAmorce';
import AujourdhuiMobile from '@/app/dashboard/_mobile/AujourdhuiMobile';
import { getDevice } from '@/lib/device-server';
import type { AgencyRow, ContextualProfile } from '@/types/database';
import type { ProfileAgencyMembership } from '@/lib/auth/active-agency';
import { fetchAgencyOverview } from '@/lib/queries/agency-overview';
import { buildSectorMapPoints } from '@/lib/carte/points';
import { buildSortie } from '@/lib/today/sortie';
import { groupEntitiesByBanId } from '@/lib/carte/buildings';
import { entreeStage } from '@/lib/queries/lead-stages';
import { formatPhoneOrNull } from '@/lib/import/normalize';
import {
  fetchAgentOnboarding,
  fetchOnboardingSecteur,
  secteurADesParcelles,
} from '@/lib/queries/agent-onboarding';
import { leadShowcasePourOnboarding } from '@/lib/onboarding/lead-showcase';
import {
  decideAffichage,
  doitProposerReprise,
  buildParcours,
  minutesRestantes,
} from '@/lib/onboarding/parcours';
import AgentOnboarding from '@/components/dashboard/onboarding/AgentOnboarding';
import OnboardingRelanceBand from '@/components/dashboard/onboarding/OnboardingRelanceBand';
import BirthdayCard from '@/components/dashboard/onboarding/BirthdayCard';
import { fetchAnniversairesDuJour } from '@/lib/queries/birthdays';
import { lirePenseBete } from '@/lib/activite/pense-bete';
import { calculerPilotage } from '@/lib/activite/pilotage';
import { estPeriode } from '@/lib/activite/semaines';
import { canSeeActivityOf } from '@/lib/agency/visibility';
import AccueilPilotage from '@/components/dashboard/accueil/AccueilPilotage';
import EcranAttenteInscription from '@/components/dashboard/abonnement/EcranAttenteInscription';
import { estEnAttente } from '@/lib/billing/acces';
import { EmploiDuTempsSquelette } from '@/components/dashboard/accueil/EmploiDuTemps';
import EmploiDuTempsServeur from '@/components/dashboard/accueil/EmploiDuTempsServeur';
import type { AdresseLivree } from '@/components/dashboard/accueil/NouvellesAdresses';
import { nomProprietaireAffiche, signauxEssentiels } from '@/lib/lead-apercu';
import { lireAgendaSemaine } from '@/lib/agenda/lire';
import { tacheDuMoment } from '@/lib/today/maintenant';
import { fetchZonesSafe } from '@/lib/queries/zones';
import { apercuSecteur } from '@/lib/zones/accueil';
import SecteurAccueil from '@/components/dashboard/accueil/SecteurAccueil';
import type { SecteursData } from '@/components/dashboard/accueil/SecteurAtelier';
import { fetchPassagesObserves } from '@/lib/queries/passages';
import { notifierAdressesARevoir, SEUIL_ADRESSES_A_REVOIR } from '@/lib/notifications/evenements';
import {
  CYCLE_DEFAUT_JOURS,
  annoterAdresse,
  cycleObserveJours,
  dernierPassageParAdresse,
} from '@/lib/zones/fraicheur';

export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<{
    'prise-en-main'?: string;
    periode?: string;
    le?: string;
    membre?: string;
  }>;
}) {
  const { user, profile, agency, memberships } = await getServerUser();
  if (!user || !profile || !agency) redirect('/login');

  const sp = await searchParams;
  const device = await getDevice();

  return (
    <Suspense
      fallback={
        <AccueilAmorce
          periodeDemandee={sp.periode ?? null}
          mobile={device === 'mobile'}
        />
      }
    >
      <TodayContent
        profile={profile}
        agency={agency}
        memberships={memberships}
        repriseDemandee={sp['prise-en-main'] === '1'}
        periodeDemandee={sp.periode ?? null}
        ancreDemandee={sp.le ?? null}
        membreDemande={sp.membre ?? null}
      />
    </Suspense>
  );
}

async function TodayContent({
  profile,
  agency,
  memberships,
  repriseDemandee,
  periodeDemandee,
  ancreDemandee,
  membreDemande,
}: {
  profile: ContextualProfile;
  agency: AgencyRow;
  memberships: ProfileAgencyMembership[];
  repriseDemandee: boolean;
  periodeDemandee: string | null;
  ancreDemandee: string | null;
  membreDemande: string | null;
}) {
  const agendaPromise = lireAgendaSemaine();
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

  const [leads, contacts, biens, dismissals, members, metier, notes, device, stages, pastRdv] =
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

  const prevSnap = await fetchWeeklySnapshot(supabase, agency.id, previousMonday());
  const portfolio = buildPortfolioStats({
    biens: visibleBiens.map((b) => ({
      id: b.id,
      mandatStatut: b.mandatStatut,
      mandatDate: b.mandatDate,
      createdAt: b.createdAt,
    })),
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
  const auteursParId = portraitsParId(members);
  const auteursParNom = portraitsParNom(members);
  const notesAccueil = recentNotesForHome(visibleNotes, {
    viewerId: profile.id,
    isDirector: layoutDirector,
    limit: 5,
    weekStartKey: ymdKey(startOfWeekYmd(new Date())),
  });
  const rattachementsAccueil = await rattachementsDesNotes({
    supabase,
    notes: notesAccueil,
  });
  const recentNotes = notesAccueil.map((note) => {
    const rattachements = rattachementsAccueil.get(note.id) ?? [];
    const attachmentLabel = homeNoteAttachment(
      note,
      note.contactId ? contactsById.get(note.contactId) ?? null : null,
      rattachements,
    );
    const author = auteurNote(note.createdBy, auteursParId);
    const titre = homeNoteTitre({ attachmentLabel, transcript: note.transcript });
    return {
      ...note,
      attachmentLabel,
      attachmentKind: homeNoteLieuKind(rattachements),
      author,
      collaborateur: portraitPourNom(titre, auteursParNom) ?? author,
    };
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

  /* --------------------------- activité terrain --------------------------- */
  // Période affichée : la semaine en cours par défaut, sinon ce que dit l'URL.
  // Passer par l'URL garde l'écran rendu côté serveur et rend une semaine
  // consultée partageable par simple copier-coller. Le changement de période,
  // lui, ne repasse plus par ici : il appelle /api/dashboard/activite.
  const periode = estPeriode(periodeDemandee) ? periodeDemandee : 'semaine';

  // Le sélecteur du directeur ne décide rien : l'autorisation se rejoue ici.
  const membreActivite =
    membreDemande && canSeeActivityOf(viewer, membreDemande) ? membreDemande : profile.id;

  const [
    assignments,
    alerts,
    week,
    demandesPortail,
    demandesEstimation,
    estimationsVuees,
    actionsAValider,
    pilotage,
    passages,
  ] = await Promise.all([
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
            telephone: formatPhoneOrNull(row.telephone as string | null),
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
            telephone: formatPhoneOrNull(row.phone as string | null),
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
    timed('listerActionsOuvertes', () =>
      listerActionsOuvertes(supabase, agency.id, {
        profileId: profile.id,
        estDirecteur: layoutDirector,
      }),
    ),
    timed('calculerPilotage', () =>
      calculerPilotage({
        supabase,
        agencyId: agency.id,
        membreActivite,
        profileIdsAgence: members.map((m) => m.id),
        stages,
        periode,
        ancre: ancreDemandee,
      }),
    ),
    timed('fetchPassagesObserves', () => fetchPassagesObserves({ supabase, stages })),
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
    // Les échéances de mandat et d'offre ne sont pas une tâche du jour : elles
    // encombraient la pile avec des offres expirées sur lesquelles il n'y a
    // plus rien à faire.
    exclure: ['echeance_contractuelle'],
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
          members: members.map((m) => ({
            id: m.id,
            fullName: m.fullName,
            firstName: m.firstName,
            lastName: m.lastName,
            avatarUrl: m.avatarUrl,
          })),
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
      members: members.map((m) => ({
        id: m.id,
        fullName: m.fullName,
        firstName: m.firstName,
        lastName: m.lastName,
        avatarUrl: m.avatarUrl,
      })),
      leads: visibleLeads.map((l) => ({ assignedTo: l.assignedTo, stageId: l.stageId })),
      notes: visibleNotes.map((n) => ({ createdBy: n.createdBy, statut: n.statut })),
      activityVolumeByMemberId: volumeById,
    });
  }

  markServerTimingReady();

  /* ---------------------------- prise en main ---------------------------- */
  // Réservée au négociateur : le directeur a eu la visio et créé le compte.
  const priseEnMain = profile.role === 'collaborateur'
    ? await timed('fetchAgentOnboarding', () => fetchAgentOnboarding(supabase, profile.id))
    : null;
  const affichage =
    profile.role === 'collaborateur'
      ? decideAffichage(priseEnMain, { demandeExplicite: repriseDemandee })
      : 'rien';

  if (affichage === 'onboarding') {
    const [secteur, aDesParcelles] = await Promise.all([
      fetchOnboardingSecteur(supabase, agency.id, agency.codes_postaux ?? []),
      secteurADesParcelles(supabase, agency.codes_postaux ?? []),
    ]);

    // Les mêmes immeubles que l'écran Carte, filtrés par la même visibilité.
    const { points } = buildSectorMapPoints({
      agencyId: agency.id,
      leads: visibleLeads,
      contacts: visibleContacts,
      biens: visibleBiens,
      notes: visibleNotes,
    });

    const sortiePlan = buildSortie(visibleLeads, profile.id, agencyOrigin);

    return (
      <div
        data-agent-onboarding
        className="flex h-full min-h-full w-full min-w-0 flex-1 flex-col overflow-hidden max-md:fixed max-md:inset-0 max-md:z-[200] max-md:bg-bg-base"
      >
        <AgentOnboarding
          profileId={profile.id}
          firstName={profile.first_name}
          lastName={profile.last_name}
          avatarUrl={profile.avatar_url ?? null}
          secteur={secteur}
          leads={leadShowcasePourOnboarding(agency.codes_postaux ?? [], visibleLeads)}
          stageEntreeId={entreeStage(stages)?.id ?? null}
          buildings={groupEntitiesByBanId(points)}
          center={{ latitude: agency.latitude, longitude: agency.longitude }}
          sortiePlan={sortiePlan}
          aDesParcelles={aDesParcelles}
          mobile={device === 'mobile'}
          reprise={
            priseEnMain
              ? { currentStep: priseEnMain.currentStep, stepsReached: priseEnMain.stepsReached }
              : null
          }
        />
      </div>
    );
  }

  const anniversaires = await timed('fetchAnniversairesDuJour', () =>
    fetchAnniversairesDuJour(supabase, agency.id),
  );

  const relance =
    profile.role === 'collaborateur' && doitProposerReprise(priseEnMain)
      ? {
          minutes: minutesRestantes(
            buildParcours({
              aDesLeads: true,
              aDesParcelles: true,
              aUneSortie: true,
              mobile: device === 'mobile',
            }),
            priseEnMain?.stepsReached ?? [],
          ),
        }
      : null;

  // Le produit vendu : les leads livrés que personne n'a pris.
  const leadsNonPris = visibleLeads
    .filter((l) => l.stageId === null)
    .sort((a, b) => b.score - a.score);
  // Six : de quoi remplir la carte jusqu'au bord de l'emploi du temps posé à
  // côté. Au-delà, la liste défilerait et « Voir tout » existe pour ça.
  const adressesLivrees: AdresseLivree[] = (estEnAttente(agency) ? [] : leadsNonPris)
    .slice(0, 6)
    .map((l) => ({
    id: l.id,
    address: l.address,
    city: l.city,
    score: l.score,
    mainSignalLabel: l.mainSignalLabel,
    ownerName: nomProprietaireAffiche(l),
    signaux: signauxEssentiels(l),
  }));

  const membresActivite =
    isDirector && !previewingAgent
      ? members.map((m) => ({
          id: m.id,
          nom: m.fullName,
          firstName: m.firstName,
          lastName: m.lastName,
          avatarUrl: m.avatarUrl,
        }))
      : [];

  const penseBete = lirePenseBete(profile.preferences);

  const maintenant = new Date();
  const repliCycleJours = agency.frequence_passage_jours ?? CYCLE_DEFAUT_JOURS;
  const cycle = cycleObserveJours(passages, profile.id, repliCycleJours);
  const derniers = dernierPassageParAdresse(passages, profile.id);
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

  const homeProps = {
    initialCards: cards,
    initialLeads: leadsAnnotes,
    profileId: profile.id,
    firstName: profile.first_name,
    portfolio,
    recentNotes,
    agencyOrigin,
    isDirector,
    previewingAgent,
    directorExceptions,
    actionsAValider,
  };

  const banners = (
    <>
      {anniversaires.length > 0 ? (
        <BirthdayCard key="anniversaires" prenoms={anniversaires.map((a) => a.firstName)} />
      ) : null}
      {relance ? <OnboardingRelanceBand key="onboarding-relance" minutes={relance.minutes} /> : null}
    </>
  );

  // Le découpage de l'agence. Sans zones, la carte ne s'affiche pas du tout :
  // un repère vide n'est pas un repère.
  const zones = await fetchZonesSafe(supabase);
  const apercu = apercuSecteur({
    leads: visibleLeads,
    zones,
    profileId: profile.id,
    estDirecteur: isDirector,
    passages,
    repliCycleJours,
    titulaires: Object.fromEntries(names),
  });
  if (!isDirector && apercu.aRevoir > SEUIL_ADRESSES_A_REVOIR) {
    after(() =>
      notifierAdressesARevoir({
        agencyId: agency.id,
        destinataireId: profile.id,
        aRevoir: apercu.aRevoir,
      }),
    );
  }

  // L'atelier de découpage vit sur l'Accueil. Il se sert des leads et des
  // membres déjà lus plus haut : aucune requête de plus pour ouvrir la carte.
  const secteursData: SecteursData = {
    zones,
    membres: members.map((m) => ({
      id: m.id,
      fullName: m.fullName,
      firstName: m.firstName,
      lastName: m.lastName,
      avatarUrl: m.avatarUrl,
    })),
    leads: visibleLeads
      .filter(
        (l): l is typeof l & { latitude: number; longitude: number } =>
          l.latitude !== null && l.longitude !== null,
      )
      .map((l) => ({
        id: l.id,
        address: l.address,
        postalCode: l.postalCode,
        latitude: l.latitude,
        longitude: l.longitude,
        assignedTo: l.assignedTo,
        stageId: l.stageId,
        pris: l.stageId != null,
        deliveredAt: l.deliveredAt,
        createdAt: l.createdAt,
      })),
    centre: { latitude: agency.latitude, longitude: agency.longitude },
    profileId: profile.id,
  };

  const secteurNode = (
    <SecteurAccueil
      key="secteur-accueil"
      apercu={apercu}
      centre={{ latitude: agency.latitude, longitude: agency.longitude }}
      estDirecteur={isDirector}
      secteurs={secteursData}
    />
  );

  const pilotageCommun = {
    pilotage,
    adresses: adressesLivrees,
    totalAdresses: leadsNonPris.length,
    sansLivraison: visibleLeads.length === 0,
    membres: membresActivite,
    membreSelectionne: membreActivite,
    moi: profile.id,
    penseBete,
    // L'emploi du temps reste rendu par le serveur : il attend l'agenda Google
    // sous son propre Suspense, sans retenir le reste de l'écran.
    emploiDuTemps: (
      <Suspense key="emploi-du-temps" fallback={<EmploiDuTempsSquelette />}>
        <EmploiDuTempsServeur agenda={agendaPromise} />
      </Suspense>
    ),
    tache: tacheDuMoment(cards),
    secteur: cards.length > 0 ? secteurNode : null,
    attenteInscription: estEnAttente(agency) ? (
      <EcranAttenteInscription key="attente-inscription" refusee={agency.demande_decision === 'refusee'} />
    ) : null,
  };

  if (device === 'mobile') {
    return (
      <>
        {banners}
        <AccueilPilotage
          {...pilotageCommun}
          aujourdhui={
            <AujourdhuiMobile
              key="today-mobile"
              {...homeProps}
              variant="pilotage"
              week={week}
              sectorRef={centroidFromCoords(visibleLeads)}
              secteur={secteurNode}
            />
          }
        />
      </>
    );
  }

  return (
    <>
      {banners}
      <AccueilPilotage
        {...pilotageCommun}
        aujourdhui={
          <TodayClient
            key="today-pilotage"
            {...homeProps}
            variant="pilotage"
            relancesProgrammees={week.relancesProgrammees}
            rapprochements={week.rapprochements}
            secteur={secteurNode}
          />
        }
      />
    </>
  );
}
