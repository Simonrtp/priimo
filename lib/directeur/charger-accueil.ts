import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { LeadStage } from '@/types/lead';
import { fetchJournalActivite, fetchObjectifs, fetchObjectifAgence } from '@/lib/queries/activite';
import {
  fetchDerniereActiviteParContact,
  fetchEstimationsPourDirecteur,
} from '@/lib/queries/directeur-accueil';
import { compteursSemaine } from '@/lib/activite/derive';
import { objectifsEffectifs } from '@/lib/activite/objectifs';
import {
  intervalleSeptJours,
  moisDe,
  semaineDe,
  semaineDecalee,
  semainePrecedente,
} from '@/lib/activite/semaines';
import { parisYmd, ymdKey } from '@/lib/today/calendar';
import { DIRECTEUR_SEUILS } from './config';
import { indicateursAgence, type VictoireSemaine } from './agence';
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
  /** Le directeur connecté — exclu des cartes « Les négociateurs » et zone 1 perso. */
  directeurProfileId: string;
  membres: readonly {
    id: string;
    firstName: string;
    lastName: string;
    fullName: string;
    avatarUrl: string | null;
  }[];
  stages: readonly LeadStage[];
  leads: readonly {
    assignedTo: string | null;
    deliveredAt: string | null;
    createdAt: string;
    stageId: string | null;
  }[];
  biensMetier: readonly {
    id: string;
    address: string;
    mandatSigneLe: string | null;
    mandatDureeMois: number;
    mandatStatut: string;
    visitCount: number;
  }[];
  biens: readonly {
    id: string;
    assignedTo: string | null;
    mandatStatut: string;
    mandatDate: string | null;
    proprietaireContactId: string | null;
  }[];
  notes: readonly { createdBy: string | null; createdAt: string }[];
  periode: 'semaine' | 'mois';
  now?: Date;
}): Promise<AccueilDirecteurModele> {
  const now = input.now ?? new Date();
  const aujourdhui = ymdKey(parisYmd(now));
  const semaine = semaineDe(now);
  const intervalle7j = intervalleSeptJours(aujourdhui);
  const semainesPrecedentes = [1, 2, 3, 4].map((d) =>
    semaineDecalee(semainePrecedente(semaine), -(d - 1)),
  );
  const couverture = {
    debut: semainesPrecedentes[3]!.debut,
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

  const [journal, objectifsRows, estimationsRows, objectifAgence] = await Promise.all([
    fetchJournalActivite({
      supabase: input.supabase,
      intervalle: couverture,
      stages: input.stages,
    }),
    Promise.all(ids.map((id) => fetchObjectifs({ supabase: input.supabase, profileId: id }))),
    fetchEstimationsPourDirecteur(input.supabase, input.agencyId),
    fetchObjectifAgence({ supabase: input.supabase, agencyId: input.agencyId }),
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

  const intervalleAffiche =
    input.periode === 'mois' ? moisDe(now) : semaine;
  const mois = moisDe(now);

  const negociateurs = membres
    .filter((m) => m.id !== input.directeurProfileId)
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

    const contactsObj = obj.hebdo.contacts_physiques;
    const estObj = obj.hebdo.estimations;
    const mandatsObj =
      input.periode === 'mois' ? obj.mandatsMensuel : obj.hebdo.mandats;
    const mandatsValeur =
      input.periode === 'mois'
        ? compteursSemaine({ journal, profileId: m.id, semaine: mois }).mandats
        : compteurs.mandats;

    const progressionParts = [
      contactsObj > 0 ? compteurs.contacts_physiques / contactsObj : 1,
      estObj > 0 ? compteurs.estimations / estObj : 1,
      mandatsObj > 0 ? mandatsValeur / mandatsObj : 1,
    ];
    const progression = Math.round(
      (progressionParts.reduce((a, b) => a + Math.min(1.5, b), 0) /
        progressionParts.length) *
        100,
    );

    return carteNegociateurDepuis(m, {
      activite7j: act.activite7j,
      moyenneHebdo4s: act.moyenneHebdo4s,
      semainesHistorique: act.semainesHistorique,
      derniereNoteAt: derniereNote,
      progression: Math.max(0, Math.min(100, progression)),
      contacts: {
        valeur: compteurs.contacts_physiques,
        objectif: contactsObj,
      },
      estimations: { valeur: compteurs.estimations, objectif: estObj },
      mandats: {
        valeur: mandatsValeur,
        objectif: mandatsObj,
      },
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
    contactsFenetre += cSem.contacts_physiques;
    mandatsFenetre += cSem.mandats;
  }

  const indicateurs = indicateursAgence({
    mandatsActifs: mandatsActifs.length,
    mandatsExclusifs: exclusifs,
    mandatsPlusDe60j: plus60,
    contactsPhysiquesFenetre: contactsFenetre,
    mandatsFenetre,
    mandatsDuMois: mandatsMoisEquipe,
    objectifMandatsMois: Math.max(1, objectifAgence ?? objectifEquipe),
  });

  const victoires: VictoireSemaine[] = [];
  for (const t of journal.transitions) {
    if (t.versCle !== 'mandat' && t.versCle !== 'rendez_vous') continue;
    if (!t.profileId) continue;
    const jour = t.createdAt.slice(0, 10);
    if (jour < semaine.debut || jour > semaine.fin) continue;
    const prenom = prenoms.get(t.profileId) ?? 'Un collègue';
    if (t.versCle === 'mandat') {
      victoires.push({ kind: 'mandat', prenom, label: 'mandat signé' });
    } else {
      victoires.push({ kind: 'rendez_vous', prenom, label: 'rendez-vous obtenu' });
    }
  }

  return assemblerAccueilDirecteur({
    membres: membres.filter((m) => m.id !== input.directeurProfileId),
    activites: activitesEquipe,
    estimations: estimationsEquipe,
    mandats: mandatsEquipe,
    prospectsSansNegociateur,
    negociateurs,
    indicateurs,
    victoires,
    now,
  });
}
