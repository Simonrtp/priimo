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
import { ACCUEIL_VUE_COOKIE } from '@/lib/today/accueil-vue';
import { resolveVueAccueilDirecteur, agencesDirecteur } from '@/lib/directeur/vue';
import { chargerAccueilDirecteur } from '@/lib/directeur/charger-accueil';
import AccueilDirecteur from '@/components/dashboard/directeur/AccueilDirecteur';
import { homeNoteAttachment, homeNoteLieuKind, homeNoteTitre, recentNotesForHome } from '@/lib/notes/inbox';
import { auteurNote, portraitsParId, portraitsParNom, portraitPourNom } from '@/lib/notes/auteur';
import { rattachementsDesNotes } from '@/lib/queries/note-rattachements';
import { mondayOf, previousMonday, toPreviousWeek } from '@/lib/today/weekly-snapshot';
import { fetchWeeklySnapshot, upsertWeeklySnapshot } from '@/lib/queries/weekly-snapshots';
import { ymdKey, startOfWeekYmd } from '@/lib/today/calendar';
import { toGeoCoord } from '@/lib/carte/coords';
import { rapprocherTousLesBiens } from '@/lib/matching/rapprochement';
import { bienIsActive } from '@/types/bien';
import { markServerTimingReady, timed } from '@/lib/perf/timing';
import TodayClient from '@/components/dashboard/today/TodayClient';
import AccueilAmorce from '@/components/dashboard/accueil/AccueilAmorce';
import AujourdhuiMobile from '@/app/dashboard/_mobile/AujourdhuiMobile';
import TachesDuJour from '@/app/dashboard/_mobile/aujourdhui/TachesDuJour';
import { tachesDuJour } from '@/lib/today/taches';
import { getDevice } from '@/lib/device-server';
import type { AgencyRow, ContextualProfile } from '@/types/database';
import type { ProfileAgencyMembership } from '@/lib/auth/active-agency';
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
import { normaliserPeriode } from '@/lib/activite/semaines';
import { canSeeActivityOf } from '@/lib/agency/visibility';
import AccueilPilotage from '@/components/dashboard/accueil/AccueilPilotage';
import EcranAttenteInscription from '@/components/dashboard/abonnement/EcranAttenteInscription';
import { estEnAttente } from '@/lib/billing/acces';
import { EmploiDuTempsSquelette } from '@/components/dashboard/accueil/EmploiDuTemps';
import EmploiDuTempsServeur from '@/components/dashboard/accueil/EmploiDuTempsServeur';
import type { AdresseLivree } from '@/components/dashboard/accueil/NouvellesAdresses';
import { nomProprietaireAffiche, signauxEssentiels } from '@/lib/lead-apercu';
import { lireAgendaSemaine } from '@/lib/agenda/lire';
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
    a?: string;
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
          ancreDemandee={sp.le ?? null}
          finDemandee={sp.a ?? null}
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
        finDemandee={sp.a ?? null}
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
  finDemandee,
  membreDemande,
}: {
  profile: ContextualProfile;
  agency: AgencyRow;
  memberships: ProfileAgencyMembership[];
  repriseDemandee: boolean;
  periodeDemandee: string | null;
  ancreDemandee: string | null;
  finDemandee: string | null;
  membreDemande: string | null;
}) {
  const agendaPromise = lireAgendaSemaine();
  const supabase = await createSupabaseServerClient();
  const cookieStore = await cookies();
  // La vue se lit dans le cookie : connue avant la moindre lecture, elle
  // décide de ce qu'on charge. Le directeur ne paie pas l'écran agent.
  const vueAccueil = resolveVueAccueilDirecteur({
    cookie: cookieStore.get(ACCUEIL_VUE_COOKIE)?.value,
  });
  const previewingAgent = profile.role === 'directeur' && vueAccueil === 'agent';
  const layoutDirector = profile.role === 'directeur' && !previewingAgent;
  const viewer = viewerFromProfile(
    previewingAgent ? { ...profile, role: 'collaborateur' } : profile,
  );
  const isDirector = profile.role === 'directeur';

  // Période affichée : la semaine en cours par défaut, sinon ce que dit l'URL.
  // Passer par l'URL garde l'écran rendu côté serveur et rend une semaine
  // consultée partageable par simple copier-coller. Le changement de période,
  // lui, ne repasse plus par ici : il appelle /api/dashboard/activite.
  const periode = normaliserPeriode(periodeDemandee);

  // Le sélecteur du directeur ne décide rien : l'autorisation se rejoue ici.
  const membreActivite =
    membreDemande && canSeeActivityOf(viewer, membreDemande) ? membreDemande : profile.id;

  /* ------------------------------------------------------------- lectures */
  // Tout part en même temps et chaque lecture n'attend que ce dont elle
  // dépend. L'accueil enchaînait jusqu'ici huit vagues d'allers-retours.
  // Aucun `await` entre ces promesses et le Promise.all de chaque écran :
  // un échec est toujours rattrapé, jamais laissé sans gestionnaire.
  const membersP = timed('fetchMembersOfMyAgency', () =>
    fetchMembersOfMyAgency(agency.id, memberships),
  );
  const stagesP = timed('fetchLeadStages', () => fetchLeadStages(supabase));
  const leadsP = timed('fetchLeads', () => fetchLeads(supabase));
  const contactsP = timed('fetchContactsSafe', () => fetchContactsSafe(supabase));
  const biensP = timed('fetchBiensSafe', () => fetchBiensSafe(supabase));
  const notesP = timed('fetchVoiceNotesSafe', () => fetchVoiceNotesSafe(supabase));
  const metierP = timed('fetchTodayMetierSafe', () => fetchTodayMetierSafe(supabase, profile.id));

  // Ce que les deux écrans partagent : visibilité, portefeuille, secteur.
  const socleP = Promise.all([
    membersP,
    stagesP,
    leadsP,
    contactsP,
    biensP,
    notesP,
    timed('fetchPastRendezVousSafe', () => fetchPastRendezVousSafe(supabase)),
    timed('fetchWeeklySnapshot', () => fetchWeeklySnapshot(supabase, agency.id, previousMonday())),
    stagesP.then((stages) =>
      timed('fetchPassagesObserves', () => fetchPassagesObserves({ supabase, stages })),
    ),
    timed('fetchZonesSafe', () => fetchZonesSafe(supabase)),
  ]).then(([members, stages, leads, contacts, biens, notes, pastRdv, prevSnap, passages, zones]) => {
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

    // Ma semaine : uniquement le secteur du négociateur. L'agence : tout le
    // découpage. Le rôle ne décide pas la carte — c'est la vue qui le fait.
    const repliCycleJours = agency.frequence_passage_jours ?? CYCLE_DEFAUT_JOURS;
    const titulaires = Object.fromEntries(names);
    const paramsApercu = {
      leads: visibleLeads,
      zones,
      profileId: profile.id,
      passages,
      repliCycleJours,
      titulaires,
    };
    const apercuAgent = apercuSecteur({ ...paramsApercu, estDirecteur: false });
    const apercuAgence = apercuSecteur({ ...paramsApercu, estDirecteur: true });

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

    return {
      members,
      stages,
      visibleContacts,
      visibleLeads,
      visibleBiens,
      visibleNotes,
      portfolio,
      passages,
      repliCycleJours,
      apercuAgent,
      apercuAgence,
      secteursData,
    };
  });

  const centreAgence = { latitude: agency.latitude, longitude: agency.longitude };

  /* ------------------------------------------------------------ directeur */
  if (layoutDirector) {
    const periodeDirecteur =
      periode === '30j' || periode === '90j' ? 'mois' : 'semaine';
    const [socle, modeleDirecteur] = await Promise.all([
      socleP,
      Promise.all([membersP, stagesP, leadsP, biensP, notesP, metierP]).then(
        ([members, stages, leads, biens, notes, metier]) =>
          timed('chargerAccueilDirecteur', () =>
            chargerAccueilDirecteur({
              supabase,
              agencyId: agency.id,
              directeurProfileId: profile.id,
              membres: members.map((m) => ({
                id: m.id,
                firstName: m.firstName,
                lastName: m.lastName,
                fullName: m.fullName,
                avatarUrl: m.avatarUrl,
              })),
              stages,
              leads: visibleLeadsFor(viewer, leads).map((l) => ({
                assignedTo: l.assignedTo,
                deliveredAt: l.deliveredAt,
                createdAt: l.createdAt,
                stageId: l.stageId,
              })),
              biensMetier: metier.biens,
              biens: visibleBiensFor(viewer, biens).map((b) => ({
                id: b.id,
                assignedTo: b.assignedTo,
                mandatStatut: b.mandatStatut,
                mandatDate: b.mandatDate,
                proprietaireContactId: b.proprietaireContactId,
              })),
              notes: visibleVoiceNotesFor(viewer, notes).map((n) => ({
                createdBy: n.createdBy,
                createdAt: n.createdAt,
              })),
              periode: periodeDirecteur,
            }),
          ),
      ),
    ]);

    const byKind = Object.fromEntries(socle.portfolio.counters.map((c) => [c.kind, c]));
    void upsertWeeklySnapshot(supabase, agency.id, {
      weekStart: mondayOf(),
      mandatsActifs: byKind['mandats-actifs']?.value ?? 0,
      leadsNonPris: byKind['leads-non-pris']?.value ?? 0,
      rdvSansSuite: byKind['rdv-sans-suite']?.value ?? byKind['estimations']?.value ?? 0,
      mandats60j: byKind['mandats-60j']?.value ?? 0,
    });

    markServerTimingReady();

    return (
      <AccueilDirecteur
        modele={modeleDirecteur}
        agences={agencesDirecteur(memberships)}
        agenceActiveId={agency.id}
        periode={periodeDirecteur}
        secteur={
          <SecteurAccueil
            key="secteur-agence"
            apercu={socle.apercuAgence}
            centre={centreAgence}
            estDirecteur
            secteurs={socle.secteursData}
          />
        }
      />
    );
  }

  /* ---------------------------------------------------------------- agent */
  const [
    socle,
    metier,
    dismissals,
    assignments,
    alerts,
    week,
    demandesPortail,
    demandesEstimation,
    estimationsVuees,
    actionsAValider,
    pilotage,
    notesDuJour,
    priseEnMain,
    anniversaires,
  ] = await Promise.all([
    socleP,
    metierP,
    timed('fetchTodayDismissals', () => fetchTodayDismissals(supabase, profile.id)),
    membersP.then((members) =>
      timed('fetchAssignmentsToMe', () =>
        fetchAssignmentsToMe(supabase, profile.id, memberNamesById(members)),
      ),
    ),
    isDirector
      ? membersP.then((members) =>
          timed('fetchAgencyAlerts', () => fetchAgencyAlerts(supabase, memberNamesById(members))),
        )
      : Promise.resolve([]),
    Promise.all([leadsP, contactsP]).then(([leads, contacts]) =>
      timed('fetchFieldWeek', () =>
        fetchFieldWeek({
          supabase,
          profileId: profile.id,
          contacts: visibleContactsFor(viewer, contacts),
          leads: visibleLeadsFor(viewer, leads),
        }),
      ),
    ),
    timed('fetchDemandesPortail', () => lireDemandesPortail(supabase, agency.id)),
    timed('fetchDemandesEstimation', () =>
      lireDemandesEstimation(supabase, agency.id, { isDirector, profileId: profile.id }),
    ),
    timed('fetchEstimationsVuees', () => lireEstimationsVuees(supabase, agency.id)),
    timed('listerActionsOuvertes', () =>
      listerActionsOuvertes(supabase, agency.id, {
        profileId: profile.id,
        estDirecteur: false,
      }),
    ),
    Promise.all([membersP, stagesP]).then(([members, stages]) =>
      timed('calculerPilotage', () =>
        calculerPilotage({
          supabase,
          agencyId: agency.id,
          membreActivite,
          profileIdsAgence: members.map((m) => m.id),
          stages,
          periode,
          ancre: ancreDemandee,
          fin: finDemandee,
        }),
      ),
    ),
    notesP.then(async (notes) => {
      const notesAccueil = recentNotesForHome(visibleVoiceNotesFor(viewer, notes), {
        viewerId: profile.id,
        isDirector: false,
        limit: 5,
        weekStartKey: ymdKey(startOfWeekYmd(new Date())),
      });
      const rattachements = await timed('rattachementsDesNotes', () =>
        rattachementsDesNotes({ supabase, notes: notesAccueil }),
      );
      return { notesAccueil, rattachements };
    }),
    // Réservée au négociateur : le directeur a eu la visio et créé le compte.
    profile.role === 'collaborateur'
      ? timed('fetchAgentOnboarding', () => fetchAgentOnboarding(supabase, profile.id))
      : Promise.resolve(null),
    timed('fetchAnniversairesDuJour', () => fetchAnniversairesDuJour(supabase, agency.id)),
  ]);

  const {
    members,
    stages,
    visibleContacts,
    visibleLeads,
    visibleBiens,
    visibleNotes,
    portfolio,
    passages,
    repliCycleJours,
    apercuAgent,
  } = socle;

  const contactsById = new Map(visibleContacts.map((c) => [c.id, c.fullName]));
  const auteursParId = portraitsParId(members);
  const auteursParNom = portraitsParNom(members);
  const recentNotes = notesDuJour.notesAccueil.map((note) => {
    const rattachements = notesDuJour.rattachements.get(note.id) ?? [];
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

  const secteurAgent = (
    <SecteurAccueil
      key="secteur-agent"
      apercu={apercuAgent}
      centre={centreAgence}
      estDirecteur={false}
      secteurs={socle.secteursData}
    />
  );

  const device = await getDevice();

  // Mobile : les tâches du jour montent en tête d'écran. Elles quittent la
  // pile ordinaire pour ne pas apparaître deux fois.
  const taches = device === 'mobile' ? tachesDuJour(metier.promesses, dismissals, new Date()) : [];
  const enTete = new Set(taches.map((t) => t.id));

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
    promesses: metier.promesses.filter((p) => !enTete.has(p.id)),
    // Les relances contact (jamais recontacté, date due) n'ont plus leur
    // place sur l'Accueil : trop de cartes, un CTA qui n'est plus la DA.
    exclure: ['echeance_contractuelle', 'relance'],
  });

  const directorExceptions: import('@/lib/today/director-exceptions').DirectorMemberExceptions[] = [];

  markServerTimingReady();

  /* ---------------------------- prise en main ---------------------------- */
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

  if (!isDirector && apercuAgent.aRevoir > SEUIL_ADRESSES_A_REVOIR) {
    after(() =>
      notifierAdressesARevoir({
        agencyId: agency.id,
        destinataireId: profile.id,
        aRevoir: apercuAgent.aRevoir,
      }),
    );
  }

  const pilotageCommun = {
    pilotage,
    adresses: adressesLivrees,
    totalAdresses: leadsNonPris.length,
    sansLivraison: visibleLeads.length === 0,
    membres: membresActivite,
    membreSelectionne: membreActivite,
    moi: profile.id,
    penseBete,
    selecteurVueDirecteur: isDirector && previewingAgent,
    // L'emploi du temps reste rendu par le serveur : il attend l'agenda Google
    // sous son propre Suspense, sans retenir le reste de l'écran.
    emploiDuTemps: (
      <Suspense key="emploi-du-temps" fallback={<EmploiDuTempsSquelette />}>
        <EmploiDuTempsServeur agenda={agendaPromise} />
      </Suspense>
    ),
    secteur: secteurAgent,
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
          taches={
            taches.length > 0 ? <TachesDuJour key="taches-du-jour" taches={taches} /> : undefined
          }
          aujourdhui={
            <AujourdhuiMobile
              key="today-mobile"
              {...homeProps}
              variant="pilotage"
              week={week}
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
          />
        }
      />
    </>
  );
}

type Db = Awaited<ReturnType<typeof createSupabaseServerClient>>;

/** Demandes reçues des portails ces trois derniers jours, encore à traiter. */
async function lireDemandesPortail(supabase: Db, agencyId: string) {
  try {
    const since = new Date();
    since.setDate(since.getDate() - 3);
    const { data } = await supabase
      .from('leads_portail')
      .select('id, nom, telephone, contact_id, bien_id, portail, created_at, biens(address)')
      .eq('agency_id', agencyId)
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
}

/**
 * Demandes d'estimation abouties. Sept jours : au-delà, le rappel n'est plus
 * une urgence du jour mais une relance ordinaire.
 */
async function lireDemandesEstimation(
  supabase: Db,
  agencyId: string,
  qui: { isDirector: boolean; profileId: string },
) {
  try {
    const since = new Date();
    since.setDate(since.getDate() - 7);
    const { data } = await supabase
      .from('estimation_requests')
      .select(
        'id, first_name, last_name, phone, contact_id, address, estimation_value, estimation_low, estimation_high, created_at, assigned_to',
      )
      .eq('agency_id', agencyId)
      .eq('consent_given', true)
      .eq('status', 'nouveau')
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false })
      .limit(20);

    return (data ?? [])
      .filter((row) => {
        // Un collaborateur ne voit que ce qui lui revient ; le directeur voit tout.
        const assignedTo = row.assigned_to as string | null;
        return qui.isDirector || !assignedTo || assignedTo === qui.profileId;
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
}

/** Estimations partagées que le propriétaire a rouvertes ces deux dernières semaines. */
async function lireEstimationsVuees(supabase: Db, agencyId: string) {
  try {
    const since = new Date();
    since.setDate(since.getDate() - 14);
    const { data } = await supabase
      .from('agency_estimations')
      .select('id, address, view_count, last_viewed_at, price_low, price_high')
      .eq('agency_id', agencyId)
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
}
