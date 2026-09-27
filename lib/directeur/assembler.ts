import type { JournalActivite } from '@/lib/activite/derive';
import { dansLaSemaine, type Intervalle } from '@/lib/activite/semaines';
import { dateKeyParis } from '@/lib/today/calendar';
import { DIRECTEUR_SEUILS } from './config';
import {
  construireCartesDirecteur,
  plafonnerCartesDirecteur,
  type ActiviteMembre,
  type DirecteurCarte,
  type EstimationSansRelanceInput,
  type MandatDirecteurInput,
} from './cartes';
import { ordreStatutNegociateur, statutNegociateur, type StatutNegociateur } from './statut';
import {
  indicateursAgence,
  progressionObjectifEquipe,
  type IndicateursAgence,
  type VictoireSemaine,
} from './agence';
import type { EstimationRelanceRow } from '@/lib/queries/directeur-accueil';
import { joursDepuisIso } from '@/lib/queries/directeur-accueil';

export type MembreDirecteur = {
  id: string;
  prenom: string;
  nom: string;
  avatarUrl: string | null;
  /** Exclure le directeur du décrochage négociateur ? Non — il peut prospecter. */
};

export type CarteNegociateur = {
  membreId: string;
  prenom: string;
  nom: string;
  avatarUrl: string | null;
  derniereNoteAt: string | null;
  progression: number;
  contacts: { valeur: number; objectif: number };
  estimations: { valeur: number; objectif: number };
  mandats: { valeur: number; objectif: number };
  statut: StatutNegociateur;
};

export type AccueilDirecteurModele = {
  titre: string;
  cartes: DirecteurCarte[];
  cartesVisibles: DirecteurCarte[];
  cartesReste: number;
  negociateurs: CarteNegociateur[];
  indicateurs: IndicateursAgence;
  progressionEquipe: number;
  victoires: VictoireSemaine[];
  solo: boolean;
};

function unitesActiviteJournal(
  journal: JournalActivite,
  profileId: string,
  intervalle: Intervalle,
): { count: number; lastAt: string | null } {
  let count = 0;
  let lastAt: string | null = null;
  const bump = (iso: string) => {
    count += 1;
    if (!lastAt || Date.parse(iso) > Date.parse(lastAt)) lastAt = iso;
  };

  for (const n of journal.notes) {
    if (n.auteurId !== profileId) continue;
    if (!dansLaSemaine(dateKeyParis(new Date(n.createdAt)), intervalle)) continue;
    bump(n.createdAt);
  }
  for (const t of journal.transitions) {
    if (t.profileId !== profileId) continue;
    if (!dansLaSemaine(dateKeyParis(new Date(t.createdAt)), intervalle)) continue;
    bump(t.createdAt);
  }
  return { count, lastAt };
}

function semainesDepuisPremiereActivite(
  journal: JournalActivite,
  profileId: string,
  now: Date,
): number {
  let first = Number.POSITIVE_INFINITY;
  for (const n of journal.notes) {
    if (n.auteurId !== profileId) continue;
    const t = Date.parse(n.createdAt);
    if (Number.isFinite(t) && t < first) first = t;
  }
  for (const tr of journal.transitions) {
    if (tr.profileId !== profileId) continue;
    const t = Date.parse(tr.createdAt);
    if (Number.isFinite(t) && t < first) first = t;
  }
  if (!Number.isFinite(first)) return 0;
  return Math.max(0, Math.floor((now.getTime() - first) / (7 * 86_400_000)));
}

export function activitesDepuisJournal(input: {
  membres: readonly MembreDirecteur[];
  journal: JournalActivite;
  intervalle7j: Intervalle;
  semainesPrecedentes: readonly Intervalle[];
  now?: Date;
}): ActiviteMembre[] {
  const now = input.now ?? new Date();
  return input.membres.map((m) => {
    const recent = unitesActiviteJournal(input.journal, m.id, input.intervalle7j);
    const parSemaine = input.semainesPrecedentes.map(
      (s) => unitesActiviteJournal(input.journal, m.id, s).count,
    );
    const historique = semainesDepuisPremiereActivite(input.journal, m.id, now);
    const moyenne =
      historique >= DIRECTEUR_SEUILS.decrochageSemainesHistorique
        ? parSemaine.reduce((a, b) => a + b, 0) / Math.max(1, input.semainesPrecedentes.length)
        : null;
    const joursSans =
      recent.lastAt == null
        ? historique > 0
          ? 30
          : null
        : Math.floor((now.getTime() - Date.parse(recent.lastAt)) / 86_400_000);

    return {
      membreId: m.id,
      prenom: m.prenom,
      activite7j: recent.count,
      joursSansActivite: joursSans,
      moyenneHebdo4s: moyenne,
      semainesHistorique: historique,
    };
  });
}

export function estimationsSansRelance(input: {
  rows: readonly EstimationRelanceRow[];
  derniereActiviteParContact: ReadonlyMap<string, string>;
  prenoms: ReadonlyMap<string, string>;
  mandatsContactIds: ReadonlySet<string>;
  now: Date;
}): EstimationSansRelanceInput[] {
  const out: EstimationSansRelanceInput[] = [];
  for (const row of input.rows) {
    if (!row.shareToken) continue;
    if (row.contactId && input.mandatsContactIds.has(row.contactId)) continue;
    const envoye = joursDepuisIso(row.createdAt, input.now);
    if (envoye < DIRECTEUR_SEUILS.estimationSansRelanceJours) continue;

    const apres = row.contactId
      ? input.derniereActiviteParContact.get(row.contactId)
      : undefined;
    if (apres && Date.parse(apres) > Date.parse(row.createdAt)) continue;

    const membreId = row.referentId ?? row.createdBy;
    out.push({
      id: row.id,
      membreId,
      prenom: membreId ? input.prenoms.get(membreId) ?? null : null,
      clientLabel: row.clientLabel,
      envoyeIlYaJours: envoye,
      consulteIlYaJours:
        row.viewCount > 0 && row.lastViewedAt
          ? joursDepuisIso(row.lastViewedAt, input.now)
          : null,
    });
  }
  return out;
}

export function assemblerAccueilDirecteur(input: {
  membres: readonly MembreDirecteur[];
  activites: readonly ActiviteMembre[];
  estimations: readonly EstimationSansRelanceInput[];
  mandats: readonly MandatDirecteurInput[];
  prospectsSansNegociateur: number;
  negociateurs: readonly CarteNegociateur[];
  indicateurs: IndicateursAgence;
  victoires: readonly VictoireSemaine[];
  now?: Date;
}): AccueilDirecteurModele {
  const cartes = construireCartesDirecteur({
    activites: input.activites,
    estimations: input.estimations,
    mandats: input.mandats,
    prospectsSansNegociateur: input.prospectsSansNegociateur,
    now: input.now,
  });
  const { visibles, reste } = plafonnerCartesDirecteur(cartes);
  const negociateurs = [...input.negociateurs].sort((a, b) => {
    const oa = ordreStatutNegociateur(a.statut);
    const ob = ordreStatutNegociateur(b.statut);
    if (oa !== ob) return oa - ob;
    return a.prenom.localeCompare(b.prenom, 'fr');
  });

  return {
    titre: "L'équipe cette semaine",
    cartes,
    cartesVisibles: visibles,
    cartesReste: reste,
    negociateurs,
    indicateurs: input.indicateurs,
    progressionEquipe: progressionObjectifEquipe(
      input.indicateurs.mandatsDuMois,
      input.indicateurs.objectifMandatsMois,
    ),
    victoires: [...input.victoires],
    solo: input.membres.length <= 1,
  };
}

export function carteNegociateurDepuis(
  membre: MembreDirecteur,
  input: {
    activite7j: number;
    moyenneHebdo4s: number | null;
    semainesHistorique: number;
    derniereNoteAt: string | null;
    progression: number;
    contacts: { valeur: number; objectif: number };
    estimations: { valeur: number; objectif: number };
    mandats: { valeur: number; objectif: number };
  },
): CarteNegociateur {
  return {
    membreId: membre.id,
    prenom: membre.prenom,
    nom: membre.nom,
    avatarUrl: membre.avatarUrl,
    derniereNoteAt: input.derniereNoteAt,
    progression: input.progression,
    contacts: input.contacts,
    estimations: input.estimations,
    mandats: input.mandats,
    statut: statutNegociateur({
      activiteRecente: input.activite7j,
      moyenneHebdo4Semaines: input.moyenneHebdo4s,
      semainesHistorique: input.semainesHistorique,
    }),
  };
}

export { indicateursAgence, statutNegociateur };
