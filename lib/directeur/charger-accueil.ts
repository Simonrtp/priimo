import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { LeadStage } from '@/types/lead';
import { fetchJournalActivite, fetchObjectifs, fetchObjectifAgence } from '@/lib/queries/activite';
import {
  fetchDerniereActiviteParContact,
  fetchEstimationsPourDirecteur,
} from '@/lib/queries/directeur-accueil';
import { progressionObjectifPersonne } from '@/lib/activite/bilan';
import { compteursSemaine } from '@/lib/activite/derive';
import { famillesAgence } from './familles';
import type { RepartitionEquipe } from '@/lib/activite/repartition';
import { secteursTravaillesPeriode } from '@/lib/activite/secteurs-periode';
import { fetchZonesPourAgence } from '@/lib/queries/zones';
import { objectifsEffectifs, saisieDepuisObjectifs } from '@/lib/activite/objectifs';
import {
  intervalleSeptJours,
  moisDe,
  nombreDeJours,
  semaineDe,
  semaineDecalee,
  semainePrecedente,
} from '@/lib/activite/semaines';
import { parisYmd, ymdKey } from '@/lib/today/calendar';
import { DIRECTEUR_SEUILS } from './config';
import { indicateursAgence } from './agence';
import { victoiresDeLaSemaine, type BienPourVictoire, type ContactPourVictoire, type LeadPourVictoire } from './victoires';
import {
  activitesDepuisJournal,
  assemblerAccueilDirecteur,
  carteNegociateurDepuis,
  estimationsSansRelance,
  type AccueilDirecteurModele,
  type MembreDirecteur,
} from './assembler';
import type { MandatDirecteurInput } from './cartes';
import { bienIsActive } from '@/types/bien';

type Client = SupabaseClient<Database>;

export async function chargerAccueilDirecteur(input: {
  supabase: Client;
  agencyId: string;
  /** Le directeur connecté. Il figure dans L'équipe, pas dans les agrégats des négociateurs. */
  directeurProfileId: string;
  membres: readonly {
    id: string;
    firstName: string;
    lastName: string;
    fullName: string;
    avatarUrl: string | null;
  }[];
  stages: readonly LeadStage[];
  leads: readonly (LeadPourVictoire & {
    assignedTo: string | null;
    deliveredAt: string | null;
    createdAt: string;
    stageId: string | null;
  })[];
  biensMetier: readonly {
    id: string;
    address: string;
    mandatSigneLe: string | null;
    mandatDureeMois: number;
    mandatStatut: string;
    visitCount: number;
  }[];
  biens: readonly (BienPourVictoire & {
    assignedTo: string | null;
    mandatDate: string | null;
  })[];
  contacts: readonly ContactPourVictoire[];
  notes: readonly { createdBy: string | null; createdAt: string }[];
  periode: 'semaine' | 'mois';
  now?: Date;
}): Promise<AccueilDirecteurModele> {
  const now = input.now ?? new Date();
  const aujourdhui = ymdKey(parisYmd(now));
  const semaine = semaineDe(now);
  const mois = moisDe(now);
  const intervalleAffiche = input.periode === 'mois' ? mois : semaine;
  const intervalle7j = intervalleSeptJours(aujourdhui);
  const semainesPrecedentes = [1, 2, 3, 4].map((d) =>
    semaineDecalee(semainePrecedente(semaine), -(d - 1)),
  );
  const debutCouverture = [semainesPrecedentes[3]!.debut, intervalleAffiche.debut].reduce((a, b) =>
    a < b ? a : b,
  );
  const couverture = {
    debut: debutCouverture,
    fin: aujourdhui,
  };

  const membres: MembreDirecteur[] = input.membres.map((m) => ({
    id: m.id,
    prenom: m.firstName || m.fullName.split(' ')[0] || 'Collègue',
    nom: m.lastName,
    avatarUrl: m.avatarUrl,
  }));
  const prenoms = new Map(membres.map((m) => [m.id, m.prenom]));
  const ids = membres.map((m) => m.id);

  const [journal, objectifsRows, estimationsRows, objectifAgence, zones] = await Promise.all([
    fetchJournalActivite({
      supabase: input.supabase,
      intervalle: couverture,
      stages: input.stages,
    }),
    Promise.all(ids.map((id) => fetchObjectifs({ supabase: input.supabase, profileId: id }))),
    fetchEstimationsPourDirecteur(input.supabase, input.agencyId),
    fetchObjectifAgence({ supabase: input.supabase, agencyId: input.agencyId }),
    fetchZonesPourAgence(input.supabase, input.agencyId).catch((err) => {
      console.error('[directeur] zones', err);
      return [];
    }),
  ]);

  const contactIds = estimationsRows
    .map((e) => e.contactId)
    .filter((id): id is string => Boolean(id));
  const derniereParContact = await fetchDerniereActiviteParContact(
    input.supabase,
    contactIds,
  );

  const mandatsContactIds = new Set(
    input.biens
      .filter((b) => bienIsActive(b.mandatStatut as never) && b.proprietaireContactId)
      .map((b) => b.proprietaireContactId as string),
  );

  const activites = activitesDepuisJournal({
    membres,
    journal,
    intervalle7j,
    semainesPrecedentes,
    now,
  });

  const estimations = estimationsSansRelance({
    rows: estimationsRows,
    derniereActiviteParContact: derniereParContact,
    prenoms,
    mandatsContactIds,
    now,
  });

  const assignedByBien = new Map(
    input.biens.map((b) => [b.id, b.assignedTo] as const),
  );

  const mandats: MandatDirecteurInput[] = input.biensMetier
    .filter((b) => b.mandatSigneLe && (b.mandatStatut === 'mandat_simple' || b.mandatStatut === 'mandat_exclusif'))
    .map((b) => {
      const membreId = assignedByBien.get(b.id) ?? null;
      return {
        id: b.id,
        address: b.address,
        membreId,
        prenom: membreId ? prenoms.get(membreId) ?? null : null,
        mandatSigneLe: b.mandatSigneLe!,
        mandatDureeMois: b.mandatDureeMois || 3,
        visitCount: b.visitCount,
      };
    });

  const seuilProspects = DIRECTEUR_SEUILS.prospectsSansNegociateurJours;
  const prospectsSansNegociateur = input.leads.filter((l) => {
    if (l.assignedTo) return false;
    const ref = l.deliveredAt ?? l.createdAt;
    const age = (now.getTime() - Date.parse(ref)) / 86_400_000;
    return age > seuilProspects;
  }).length;

  const secteurs = await secteursTravaillesPeriode({
    supabase: input.supabase,
    journal,
    profileIds: ids,
    intervalle: intervalleAffiche,
    zones,
  });

  const comptesSecteurs = new Map<string, { travailles: number; total: number }>();
  for (const secteur of secteurs) {
    if (!secteur.titulaireId) continue;
    const compte = comptesSecteurs.get(secteur.titulaireId) ?? { travailles: 0, total: 0 };
    compte.total += 1;
    if (secteur.travaille) compte.travailles += 1;
    comptesSecteurs.set(secteur.titulaireId, compte);
  }

  const facteur = nombreDeJours(intervalleAffiche) / 7;
  const negociateurs = [...membres]
    .sort((a, b) => {
      if (a.id === input.directeurProfileId) return -1;
      if (b.id === input.directeurProfileId) return 1;
      return 0;
    })
    .map((m) => {
    const i = membres.findIndex((x) => x.id === m.id);
    const obj = objectifsEffectifs(objectifsRows[i] ?? []);
    const compteurs = compteursSemaine({
      journal,
      profileId: m.id,
      semaine: intervalleAffiche,
    });
    const act = activites.find((a) => a.membreId === m.id)!;
    const derniereNote =
      journal.notes
        .filter((n) => n.auteurId === m.id)
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0]
        ?.createdAt ?? null;

    const contactsObj = obj.hebdo.immeubles_prospectes;
    const estObj = Math.max(0, Math.round(obj.hebdo.estimations * facteur));
    const qualifiesObj = Math.max(0, Math.round(obj.hebdo.contacts_qualifies * facteur));
    const mandatsObj =
      input.periode === 'mois' ? obj.mandatsMensuel : obj.hebdo.mandats;
    const mandatsValeur =
      input.periode === 'mois'
        ? compteursSemaine({ journal, profileId: m.id, semaine: mois }).mandats
        : compteurs.mandats;
    const sec = comptesSecteurs.get(m.id) ?? { travailles: 0, total: 0 };

    return carteNegociateurDepuis(m, {
      activite7j: act.activite7j,
      moyenneHebdo4s: act.moyenneHebdo4s,
      semainesHistorique: act.semainesHistorique,
      derniereNoteAt: derniereNote,
      progression: progressionObjectifPersonne(
        compteurs.contacts_qualifies,
        qualifiesObj,
        compteurs.estimations,
        estObj,
      ),
      contacts: {
        valeur: compteurs.immeubles_prospectes,
        objectif: contactsObj,
      },
      estimations: { valeur: compteurs.estimations, objectif: estObj },
      mandats: {
        valeur: mandatsValeur,
        objectif: mandatsObj,
      },
      qualifies: { valeur: compteurs.contacts_qualifies, objectif: qualifiesObj },
      notes: compteurs.informations_terrain,
      secteurs: sec,
      objectifs: saisieDepuisObjectifs(obj),
    });
  });

  const activitesEquipe = activites.filter((a) => a.membreId !== input.directeurProfileId);
  const estimationsEquipe = estimations.filter(
    (e) => e.membreId !== input.directeurProfileId,
  );
  const mandatsEquipe = mandats.filter(
    (m) => m.membreId !== input.directeurProfileId,
  );

  const mandatsActifs = input.biensMetier.filter(
    (b) => b.mandatStatut === 'mandat_simple' || b.mandatStatut === 'mandat_exclusif',
  );
  const exclusifs = mandatsActifs.filter((b) => b.mandatStatut === 'mandat_exclusif').length;
  const plus60 = mandats.filter((m) => {
    const age = (now.getTime() - Date.parse(`${m.mandatSigneLe}T12:00:00Z`)) / 86_400_000;
    return age > DIRECTEUR_SEUILS.mandatVieillitJours;
  }).length;

  // Objectif équipe : posé au niveau agence, sinon somme des objectifs individuels.
  let objectifEquipe = 0;
  let mandatsMoisEquipe = 0;
  let contactsFenetre = 0;
  let mandatsFenetre = 0;
  for (let i = 0; i < membres.length; i++) {
    const obj = objectifsEffectifs(objectifsRows[i] ?? []);
    objectifEquipe += obj.mandatsMensuel;
    const cMois = compteursSemaine({
      journal,
      profileId: membres[i]!.id,
      semaine: mois,
    });
    mandatsMoisEquipe += cMois.mandats;
    const cSem = compteursSemaine({
      journal,
      profileId: membres[i]!.id,
      semaine,
    });
    contactsFenetre += cSem.immeubles_prospectes;
    mandatsFenetre += cSem.mandats;
  }

  const equipe: RepartitionEquipe[] = membres.map((m) => {
    const compteurs = compteursSemaine({
      journal,
      profileId: m.id,
      semaine: intervalleAffiche,
    });
    const sec = comptesSecteurs.get(m.id) ?? { travailles: 0, total: 0 };
    return {
      prenom: m.prenom,
      contacts: compteurs.contacts_qualifies,
      notes: compteurs.informations_terrain,
      secteursTravailles: sec.travailles,
      secteursTotal: sec.total,
    };
  });

  const familles = famillesAgence({
    journal,
    profileIds: ids,
    objectifs: objectifsRows.map((rows) => objectifsEffectifs(rows ?? [])),
    intervalle: intervalleAffiche,
  });

  const indicateurs = indicateursAgence({
    mandatsActifs: mandatsActifs.length,
    mandatsExclusifs: exclusifs,
    mandatsPlusDe60j: plus60,
    contactsPhysiquesFenetre: contactsFenetre,
    mandatsFenetre,
    mandatsDuMois: mandatsMoisEquipe,
    objectifMandatsMois: Math.max(1, objectifAgence ?? objectifEquipe),
  });

  const victoires = victoiresDeLaSemaine({
    transitions: journal.transitions,
    semaine,
    prenoms,
    leads: input.leads,
    biens: input.biens,
    contacts: input.contacts,
  });

  return assemblerAccueilDirecteur({
    membres: membres.filter((m) => m.id !== input.directeurProfileId),
    activites: activitesEquipe,
    estimations: estimationsEquipe,
    mandats: mandatsEquipe,
    prospectsSansNegociateur,
    negociateurs,
    directeurId: input.directeurProfileId,
    indicateurs,
    familles,
    secteurs,
    equipe,
    victoires,
    now,
  });
}
