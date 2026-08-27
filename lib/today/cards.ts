/**
 * Moteur de l'écran Aujourd'hui.
 *
 * Ne stocke rien : les cartes sont recalculées à chaque chargement à partir des
 * données vivantes. Une carte est une action à faire maintenant, pas un compteur.
 * Aucune dépendance React ni Supabase ici, pour rester lisible et testable.
 */

import type { Lead } from '@/types/lead';
import type { Contact } from '@/types/contact';
import { CONTACT_TYPE_LABELS } from '@/types/contact';
import type { MatchAcquereur, RapprochableBien } from '@/lib/matching/rapprochement';
import type { TodayAssignmentItem } from '@/lib/queries/assignments';
import type { TodayAlertItem } from '@/lib/queries/alerts';
import type {
  TodayBienMetier,
  TodayOffre,
  TodayPromesse,
  TodayRendezVous,
  TodayVisite,
} from '@/types/metier';
import { plafonnerEtRegrouper } from '@/lib/today/cap-display';
import {
  cartesEcheanceContractuelle,
  cartesMandatSansVisite,
  cartesPostVisite,
  cartesPromesse,
  cartesRendezVousMetier,
} from '@/lib/today/metier-cards';
import { ENJEU_PAR_TYPE, imminenceJoursRestants, scoreCarte } from '@/lib/today/scoring';
import { geoFrom, type FieldGeo } from '@/lib/today/field';

/** Le strict nécessaire d'un lead pour produire une carte. */
export type TodayLead = Pick<
  Lead,
  | 'id'
  | 'address'
  | 'status'
  | 'score'
  | 'mainSignalLabel'
  | 'propertyType'
  | 'surfaceM2'
  | 'deliveredAt'
  | 'createdAt'
  | 'latitude'
  | 'longitude'
>;

/* -------------------------------------------------------------------------- */
/* Configuration                                                              */
/* -------------------------------------------------------------------------- */

export interface TodayConfig {
  /** Un contact sans échange depuis ce nombre de jours mérite une relance. */
  relanceApresJours: number;
  /** Au-delà, la relance est en retard et passe en tête de pile. */
  relanceEnRetardJours: number;
  /** Une adresse détectée reste « nouvelle » pendant ce nombre de jours. */
  nouvelleAdresseFraicheurJours: number;
  maxRelances: number;
  maxNouvellesAdresses: number;
  maxRapprochements: number;
}

export const TODAY_CONFIG: TodayConfig = {
  relanceApresJours: 7,
  relanceEnRetardJours: 21,
  nouvelleAdresseFraicheurJours: 14,
  maxRelances: 8,
  maxNouvellesAdresses: 5,
  maxRapprochements: 5,
};

/* -------------------------------------------------------------------------- */
/* Modèle de carte                                                            */
/* -------------------------------------------------------------------------- */

export type TodayCardType =
  | 'echeance_contractuelle'
  | 'post_visite'
  | 'promesse'
  | 'mandat_sans_visite'
  | 'relance'
  | 'rapprochement'
  | 'nouvelle_adresse'
  | 'rendez_vous'
  | 'transmis'
  | 'alerte'
  | 'demande_portail'
  | 'estimation_vuee';

export const TODAY_CARD_LABELS: Record<TodayCardType, string> = {
  echeance_contractuelle: 'Échéance',
  post_visite: 'Post-visite',
  promesse: 'Promesse',
  mandat_sans_visite: 'Mandat',
  alerte: 'Urgent',
  transmis: 'Transmis',
  rendez_vous: 'Rendez-vous',
  relance: 'Relance',
  rapprochement: 'Rapprochement',
  nouvelle_adresse: 'Nouvelle adresse',
  demande_portail: 'Demande portail',
  estimation_vuee: 'Avis consulté',
};

export type TodayCardAction =
  | { kind: 'appeler'; label: string; phone: string; contactId?: string; leadId?: string }
  | { kind: 'ouvrir_contact'; label: string; contactId: string }
  | { kind: 'ouvrir_lead'; label: string; leadId: string }
  | { kind: 'voir_acquereurs'; label: string; bienId: string }
  | { kind: 'ouvrir_bien'; label: string; bienId: string }
  | { kind: 'ouvrir_promesse'; label: string; promesseId: string }
  | { kind: 'ouvrir_rdv'; label: string; rdvId: string }
  | { kind: 'ouvrir_estimation'; label: string; estimationId: string }
  | { kind: 'ouvrir_liste'; label: string; cardType: TodayCardType };

export interface TodayMatchSummary {
  contactId: string;
  name: string;
  phone: string | null;
  raisons: string[];
}

export interface TodayCard {
  /** Clé stable, utilisée pour reporter ou ignorer durablement. */
  key: string;
  type: TodayCardType;
  /** L'information principale, affichée en grand. */
  headline: string;
  /** Une seule ligne de contexte, en texte secondaire. */
  context: string;
  action: TodayCardAction;
  /** Enjeu métier 0–100. */
  enjeu: number;
  /** Urgence temporelle 0–100. */
  imminence: number;
  /** Tri principal : enjeu × imminence. */
  score: number;
  /** Faux pour les échéances contractuelles (pas de swipe). */
  dismissible: boolean;
  /** @deprecated Tri legacy — préférer score. */
  priority: number;
  /** Vrai quand l'attente a trop duré : sert au résumé en tête d'écran. */
  urgent: boolean;
  /** Carte regroupée : clés des cartes masquées. */
  groupedKeys?: string[];
  /** Renseigné uniquement pour les rapprochements. */
  matches?: TodayMatchSummary[];
  /** Présent seulement si l’adresse est déjà géocodée. */
  geo?: FieldGeo | null;
}

/** Familles de priorité legacy. */
const PRIORITE = {
  alerte: 0,
  rendezVous: 50,
  transmis: 400,
  relanceEnRetard: 1000,
  relance: 2000,
  rapprochement: 3000,
  nouvelleAdresse: 4000,
} as const;

/* -------------------------------------------------------------------------- */
/* Utilitaires                                                                */
/* -------------------------------------------------------------------------- */

function joursDepuis(iso: string | null, maintenant: Date): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.floor((maintenant.getTime() - t) / 86_400_000);
}

function mkCard(
  partial: Omit<TodayCard, 'enjeu' | 'imminence' | 'score' | 'dismissible' | 'priority'> & {
    priority?: number;
  },
  imminence: number,
  dismissible = true,
): TodayCard {
  const enjeu = ENJEU_PAR_TYPE[partial.type];
  const score = scoreCarte(enjeu, imminence);
  return {
    ...partial,
    enjeu,
    imminence,
    score,
    dismissible,
    priority: partial.priority ?? 5000 - score,
  };
}

function phraseDelai(jours: number): string {
  if (jours <= 0) return "aujourd'hui";
  if (jours === 1) return 'hier';
  if (jours < 30) return `il y a ${jours} jours`;
  const mois = Math.round(jours / 30);
  return mois <= 1 ? 'il y a un mois' : `il y a ${mois} mois`;
}

/* -------------------------------------------------------------------------- */
/* Constructeurs de cartes                                                    */
/* -------------------------------------------------------------------------- */

function civilKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function cartesRelance(contacts: readonly Contact[], maintenant: Date, config: TodayConfig): TodayCard[] {
  const cartes: TodayCard[] = [];
  const today = civilKey(maintenant);

  for (const contact of contacts) {
    const due = contact.recontacterLe?.slice(0, 10) ?? null;
    if (due && due > today) continue;

    let jours: number | null;
    let enRetard: boolean;
    let contexteRelance: string;

    if (due) {
      jours = joursDepuis(`${due}T12:00:00.000Z`, maintenant);
      enRetard = due < today;
      contexteRelance = enRetard
        ? `relance prévue le ${due.split('-').reverse().join('/')}`
        : 'à relancer aujourd’hui';
    } else {
      const reference = contact.lastInteractionAt ?? contact.createdAt;
      jours = joursDepuis(reference, maintenant);
      if (jours === null || jours < config.relanceApresJours) continue;
      enRetard = jours >= config.relanceEnRetardJours;
      const jamaisRecontacte = contact.lastInteractionAt === null;
      contexteRelance = jamaisRecontacte
        ? `rencontré ${phraseDelai(jours)}, jamais recontacté`
        : `dernier échange ${phraseDelai(jours)}`;
    }

    const contexteParts = [CONTACT_TYPE_LABELS[contact.type], contexteRelance];
    if (contact.secteur) contexteParts.push(contact.secteur);

    const joursTri = Math.min(Math.max(jours ?? 0, 0), 365);

    cartes.push(
      mkCard(
        {
          key: `relance:${contact.id}`,
          type: 'relance',
          headline: contact.fullName,
          context: contexteParts.join(' · '),
          action: contact.phone
            ? { kind: 'appeler', label: `Appeler ${contact.fullName}`, phone: contact.phone, contactId: contact.id }
            : { kind: 'ouvrir_contact', label: `Ouvrir la fiche de ${contact.fullName}`, contactId: contact.id },
          priority: (enRetard ? PRIORITE.relanceEnRetard : PRIORITE.relance) - joursTri,
          urgent: enRetard,
          geo: geoFrom(contact.latitude, contact.longitude, contact.address ?? contact.fullName),
        },
        enRetard
          ? 100
          : due
            ? 85
            : imminenceJoursRestants(
                (jours ?? 0) - config.relanceApresJours,
                config.relanceEnRetardJours - config.relanceApresJours,
              ) || 45,
      ),
    );
  }

  cartes.sort((a, b) => b.score - a.score);
  return cartes.slice(0, config.maxRelances);
}

function cartesNouvelleAdresse(
  leads: readonly TodayLead[],
  maintenant: Date,
  config: TodayConfig,
): TodayCard[] {
  const cartes: TodayCard[] = [];

  for (const lead of leads) {
    if (lead.status !== 'nouveau') continue;
    const jours = joursDepuis(lead.deliveredAt ?? lead.createdAt, maintenant);
    if (jours !== null && jours > config.nouvelleAdresseFraicheurJours) continue;

    const contexteParts: string[] = [];
    if (lead.mainSignalLabel) contexteParts.push(lead.mainSignalLabel);
    if (lead.propertyType) contexteParts.push(lead.propertyType);
    if (lead.surfaceM2) contexteParts.push(`${lead.surfaceM2} m²`);
    if (contexteParts.length === 0) contexteParts.push('Adresse à travailler');

    cartes.push(
      mkCard(
        {
          key: `adresse:${lead.id}`,
          type: 'nouvelle_adresse',
          headline: lead.address,
          context: contexteParts.join(' · '),
          action: { kind: 'ouvrir_lead', label: "Préparer l'appel", leadId: lead.id },
          priority: PRIORITE.nouvelleAdresse - Math.min(lead.score ?? 0, 999),
          urgent: false,
          geo: geoFrom(lead.latitude, lead.longitude, lead.address),
        },
        jours !== null ? imminenceJoursRestants(Math.max(0, config.nouvelleAdresseFraicheurJours - jours), config.nouvelleAdresseFraicheurJours) || 35 : 35,
      ),
    );
  }

  cartes.sort((a, b) => b.score - a.score);
  return cartes.slice(0, config.maxNouvellesAdresses);
}

function cartesRapprochement(
  rapprochements: ReadonlyArray<{ bien: RapprochableBien; matches: MatchAcquereur[] }>,
  config: TodayConfig,
): TodayCard[] {
  const cartes: TodayCard[] = [];

  for (const { bien, matches } of rapprochements) {
    if (matches.length === 0) continue;

    const nombre = matches.length;
    const contexteParts = [
      nombre === 1 ? '1 acquéreur correspond' : `${nombre} acquéreurs correspondent`,
    ];
    if (bien.price) contexteParts.push(`${new Intl.NumberFormat('fr-FR').format(bien.price)} €`);
    if (bien.surfaceM2) contexteParts.push(`${bien.surfaceM2} m²`);

    cartes.push(
      mkCard(
        {
          key: `rapprochement:${bien.id}`,
          type: 'rapprochement',
          headline: bien.address,
          context: contexteParts.join(' · '),
          action: {
            kind: 'voir_acquereurs',
            label: nombre === 1 ? "Voir l'acquéreur" : 'Voir les acquéreurs',
            bienId: bien.id,
          },
          priority: PRIORITE.rapprochement - Math.min(nombre, 99),
          urgent: false,
          matches: matches.map((m) => ({
            contactId: m.contact.id,
            name: m.contact.fullName,
            phone: m.contact.phone,
            raisons: m.raisons,
          })),
          geo: geoFrom(bien.latitude, bien.longitude, bien.address),
        },
        50 + Math.min(nombre, 5) * 8,
      ),
    );
  }

  cartes.sort((a, b) => b.score - a.score);
  return cartes.slice(0, config.maxRapprochements);
}

function cartesTransmis(assignments: readonly TodayAssignmentItem[]): TodayCard[] {
  return assignments.map((item, index) => {
    const action: TodayCardAction = item.leadId
      ? { kind: 'ouvrir_lead', label: "Ouvrir l'adresse", leadId: item.leadId }
      : {
          kind: 'ouvrir_contact',
          label: 'Ouvrir la fiche',
          contactId: item.contactId ?? item.id,
        };

    return mkCard(
      {
        key: `transmis:${item.kind}:${item.id}`,
        type: 'transmis',
        headline: `Transmis par ${item.assignedByName}`,
        context: [item.headline, item.context].filter(Boolean).join(' · '),
        action,
        priority: PRIORITE.transmis - index,
        urgent: false,
      },
      65 - index * 3,
    );
  });
}

function cartesAlerte(alerts: readonly TodayAlertItem[]): TodayCard[] {
  return alerts.map((alert, index) => {
    const action: TodayCardAction = alert.leadId
      ? { kind: 'ouvrir_lead', label: 'Voir le prospect', leadId: alert.leadId }
      : alert.contactId
        ? { kind: 'ouvrir_contact', label: 'Voir le contact', contactId: alert.contactId }
        : { kind: 'ouvrir_contact', label: 'Voir la fiche', contactId: alert.id };

    return mkCard(
      {
        key: `alerte:${alert.id}`,
        type: 'alerte',
        headline: alert.headline,
        context: alert.context,
        action,
        priority: PRIORITE.alerte - index,
        urgent: true,
      },
      95 - index * 5,
    );
  });
}

/* -------------------------------------------------------------------------- */
/* Demandes portail                                                           */
/* -------------------------------------------------------------------------- */

export type TodayDemandePortail = {
  id: string;
  nom: string | null;
  telephone: string | null;
  contactId: string | null;
  bienId: string | null;
  bienAdresse: string | null;
  portail: string;
  createdAt: string;
};

function cartesDemandePortail(
  demandes: readonly TodayDemandePortail[],
  now: Date,
): TodayCard[] {
  return demandes.slice(0, 8).map((d, index) => {
    const ageH = (now.getTime() - Date.parse(d.createdAt)) / 3_600_000;
    const imminence = Number.isFinite(ageH) ? Math.max(20, 100 - Math.round(ageH * 4)) : 80;
    const name = (d.nom ?? 'Acquéreur').trim() || 'Acquéreur';
    const bien = (d.bienAdresse ?? 'Bien non rattaché').trim();
    const action =
      d.telephone
        ? ({
            kind: 'appeler' as const,
            label: 'Appeler',
            phone: d.telephone,
            contactId: d.contactId ?? undefined,
          })
        : d.contactId
          ? ({
              kind: 'ouvrir_contact' as const,
              label: 'Ouvrir le contact',
              contactId: d.contactId,
            })
          : ({
              kind: 'ouvrir_liste' as const,
              label: 'Voir les contacts',
              cardType: 'demande_portail' as const,
            });

    return mkCard(
      {
        key: `demande_portail:${d.id}`,
        type: 'demande_portail',
        headline: name,
        context: `${bien} · ${d.portail}`,
        action,
        urgent: ageH < 4,
        priority: 50 - index,
      },
      imminence,
    );
  });
}

/* -------------------------------------------------------------------------- */
/* Avis de valeur consultés                                                   */
/* -------------------------------------------------------------------------- */

export type TodayEstimationVuee = {
  id: string;
  address: string;
  viewCount: number;
  lastViewedAt: string;
  priceLow: number | null;
  priceHigh: number | null;
};

function cartesEstimationVuee(
  items: readonly TodayEstimationVuee[],
  now: Date,
): TodayCard[] {
  return items.slice(0, 8).map((e, index) => {
    const ageH = (now.getTime() - Date.parse(e.lastViewedAt)) / 3_600_000;
    const imminence = Number.isFinite(ageH) ? Math.max(25, 100 - Math.round(ageH * 2)) : 70;
    const vues = e.viewCount;
    const range =
      e.priceLow != null && e.priceHigh != null
        ? `${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(e.priceLow)} – ${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(e.priceHigh)}`
        : null;

    return mkCard(
      {
        key: `estimation_vuee:${e.id}`,
        type: 'estimation_vuee',
        headline: e.address,
        context:
          `${vues} ouverture${vues > 1 ? 's' : ''} de l’avis` +
          (range ? ` · ${range}` : ''),
        action: {
          kind: 'ouvrir_estimation',
          label: 'Voir l’estimation',
          estimationId: e.id,
        },
        urgent: vues >= 3 && ageH < 48,
        priority: 45 - index,
      },
      imminence,
    );
  });
}

/* -------------------------------------------------------------------------- */
/* Assemblage                                                                 */
/* -------------------------------------------------------------------------- */

export interface BuildTodayInput {
  leads: readonly TodayLead[];
  contacts: readonly Contact[];
  rapprochements: ReadonlyArray<{ bien: RapprochableBien; matches: MatchAcquereur[] }>;
  /** clé de carte → date de réapparition, ou null si ignorée définitivement. */
  dismissals: ReadonlyMap<string, string | null>;
  assignments?: readonly TodayAssignmentItem[];
  alerts?: readonly TodayAlertItem[];
  biensMetier?: readonly TodayBienMetier[];
  visites?: readonly TodayVisite[];
  offres?: readonly TodayOffre[];
  promesses?: readonly TodayPromesse[];
  rendezVous?: readonly TodayRendezVous[];
  /** Demandes entrantes portail (24–72 h). */
  demandesPortail?: readonly TodayDemandePortail[];
  /** Avis de valeur ouverts par le destinataire. */
  estimationsVuees?: readonly TodayEstimationVuee[];
  now?: Date;
  config?: TodayConfig;
  /** Applique le plafond à 7 cartes avec regroupement. */
  plafonner?: boolean;
}

export function buildTodayCards({
  leads,
  contacts,
  rapprochements,
  dismissals,
  assignments = [],
  alerts = [],
  biensMetier = [],
  visites = [],
  offres = [],
  promesses = [],
  rendezVous = [],
  demandesPortail = [],
  estimationsVuees = [],
  now = new Date(),
  config = TODAY_CONFIG,
  plafonner = true,
}: BuildTodayInput): TodayCard[] {
  const cartes = [
    ...cartesEcheanceContractuelle(biensMetier, offres, now),
    ...cartesAlerte(alerts),
    ...cartesPostVisite(visites, now),
    ...cartesMandatSansVisite(biensMetier, now),
    ...cartesPromesse(promesses, now),
    ...cartesRendezVousMetier(rendezVous, now),
    ...cartesTransmis(assignments),
    ...cartesDemandePortail(demandesPortail ?? [], now),
    ...cartesEstimationVuee(estimationsVuees ?? [], now),
    ...cartesRelance(contacts, now, config),
    ...cartesRapprochement(rapprochements, config),
  ];

  const filtrees = cartes
    .filter((c) => !estEcartee(c.key, dismissals, now))
    .sort((a, b) => b.score - a.score);

  return plafonner ? plafonnerEtRegrouper(filtrees) : filtrees;
}

/** Une carte reste masquée tant que la date de report n'est pas passée. */
export function estEcartee(
  key: string,
  dismissals: ReadonlyMap<string, string | null>,
  now: Date,
): boolean {
  if (!dismissals.has(key)) return false;
  const until = dismissals.get(key) ?? null;
  if (until === null) return true; // ignorée définitivement
  const t = Date.parse(until);
  return Number.isNaN(t) ? false : t > now.getTime();
}

/* -------------------------------------------------------------------------- */
/* Résumé de tête d'écran                                                     */
/* -------------------------------------------------------------------------- */

export interface TodaySummaryGroup {
  type: TodayCardType;
  count: number;
  /** Ce qu'il y a à faire, formulé par un verbe. Jamais un nom de métrique. */
  label: string;
  /** La quantité de travail, avec son unité en clair. */
  headline: string;
  /** Une précision qui aide à décider par où commencer. */
  context: string | null;
}

/** Ordre d'affichage : le même que celui de la pile. */
const ORDRE_RESUME: readonly TodayCardType[] = [
  'demande_portail',
  'estimation_vuee',
  'echeance_contractuelle',
  'alerte',
  'post_visite',
  'mandat_sans_visite',
  'promesse',
  'rendez_vous',
  'transmis',
  'relance',
  'rapprochement',
  'nouvelle_adresse',
];

function pluriel(n: number, singulier: string, pluriel: string): string {
  return `${n} ${n > 1 ? pluriel : singulier}`;
}

/**
 * Regroupe la pile en quelques têtes de chapitre.
 *
 * Ce n'est pas un tableau de bord : chaque entrée est un paquet de travail sur
 * lequel on peut cliquer pour ne voir que lui. Rien n'est affiché qui ne
 * corresponde pas à une carte réellement présente dans la pile.
 */
export function summarizeTodayCards(cards: readonly TodayCard[]): TodaySummaryGroup[] {
  const groups: TodaySummaryGroup[] = [];

  for (const type of ORDRE_RESUME) {
    const subset = cards.filter((c) => c.type === type);
    if (subset.length === 0) continue;

    const count = subset.length;

    if (type === 'alerte') {
      groups.push({
        type,
        count,
        label: 'Urgent',
        headline: pluriel(count, 'signalement', 'signalements'),
        context: 'à traiter en priorité',
      });
      continue;
    }

    if (type === 'transmis') {
      groups.push({
        type,
        count,
        label: 'Reçus',
        headline: pluriel(count, 'dossier transmis', 'dossiers transmis'),
        context: 'par un collègue',
      });
      continue;
    }

    if (type === 'estimation_vuee') {
      groups.push({
        type,
        count,
        label: 'Consultés',
        headline: pluriel(count, 'avis ouvert', 'avis ouverts'),
        context: 'par le propriétaire',
      });
      continue;
    }

    if (type === 'demande_portail') {
      groups.push({
        type,
        count,
        label: 'Entrants',
        headline: pluriel(count, 'demande portail', 'demandes portail'),
        context: 'à rappeler',
      });
      continue;
    }

    if (type === 'rendez_vous') {
      groups.push({
        type,
        count,
        label: 'Au programme',
        headline: pluriel(count, 'rendez-vous', 'rendez-vous'),
        context: null,
      });
      continue;
    }

    if (type === 'relance') {
      const enRetard = subset.filter((c) => c.urgent).length;
      groups.push({
        type,
        count,
        label: 'À rappeler',
        headline: pluriel(count, 'personne', 'personnes'),
        context:
          enRetard > 0
            ? `${enRetard > 1 ? `${enRetard} attendent` : '1 attend'} depuis plus de trois semaines`
            : null,
      });
      continue;
    }

    if (type === 'rapprochement') {
      const acquereurs = subset.reduce((sum, c) => sum + (c.matches?.length ?? 0), 0);
      groups.push({
        type,
        count,
        label: 'À proposer',
        headline: pluriel(count, 'bien', 'biens'),
        context: acquereurs > 0 ? `${pluriel(acquereurs, 'acquéreur', 'acquéreurs')} concernés` : null,
      });
      continue;
    }

    groups.push({
      type,
      count,
      label: 'À ouvrir',
      headline: pluriel(count, 'adresse', 'adresses'),
      context: 'repérées récemment',
    });
  }

  return groups;
}

/** « 3 choses à faire » — jamais un compteur décoratif, toujours une quantité de travail. */
export function phraseCharge(nombre: number): string {
  if (nombre === 0) return 'Rien en attente';
  if (nombre === 1) return '1 chose à faire';
  return `${nombre} choses à faire`;
}

export function salutation(prenom: string): string {
  const p = prenom.trim();
  return p ? `Bonjour ${p}` : 'Bonjour';
}

export function dateDuJour(now: Date = new Date()): string {
  const s = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(now);
  return s.charAt(0).toLocaleUpperCase('fr') + s.slice(1);
}
