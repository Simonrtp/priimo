/**
 * Immeubles suivis — ce qui bouge sur une parcelle qu'un agent a choisi de
 * surveiller depuis sa fiche : un nouveau DPE, une vente, un audit
 * énergétique. Chacun devient une proposition dans sa boîte « À valider ».
 *
 * « Nouveau » se juge à l'entrée dans nos données (`creeLe`), pas à la date
 * de l'acte : une vente de mars publiée en septembre reste une nouvelle pour
 * qui suit l'immeuble depuis juin. Les audits viennent de l'ADEME en direct :
 * leur date d'établissement fait foi.
 *
 * Module pur : la collecte vit dans `collecte.ts`.
 */

import type { AuditEnergetique } from '@/lib/carte/audits';
import { formatDpeEtage, parseDpeLetter } from '@/lib/carte/dpe-public';
import { dedupKey } from './dedup';
import { clampScore, expiresInDays, type ProposedAction } from './types';

export interface ImmeubleSuivi {
  parcelleId: string;
  banId: string | null;
  libelle: string | null;
  profileId: string;
  /** Date du suivi (ISO). */
  creeLe: string;
}

export interface DpeArrive {
  numero: string | null;
  date: string | null;
  etiquette: string | null;
  surface: number | null;
  etage: number | null;
  /** Entrée dans nos données (ISO). */
  creeLe: string;
}

export interface VenteArrivee {
  date: string;
  prix: number | null;
  typeLocal: string | null;
  surface: number | null;
  pieces: number | null;
  creeLe: string;
}

export interface EvenementsImmeuble {
  dpe: readonly DpeArrive[];
  ventes: readonly VenteArrivee[];
  audits: readonly AuditEnergetique[];
}

/** Au plus trois propositions par immeuble et par passage : au-delà, c'est du bruit. */
const PAR_IMMEUBLE = 3;
const EXPIRATION_JOURS = 30;

function euros(n: number): string {
  return `${new Intl.NumberFormat('fr-FR').format(Math.round(n))} €`;
}

function lieu(s: ImmeubleSuivi): string {
  return s.libelle?.trim() || 'Immeuble suivi';
}

function decrireLogement(etage: number | null, surface: number | null): string | null {
  const morceaux = [
    formatDpeEtage(etage != null && etage >= 1 ? etage : null),
    surface ? `${Math.round(surface)} m²` : null,
  ].filter(Boolean);
  return morceaux.length > 0 ? morceaux.join(' · ') : null;
}

export function proposerImmeublesSuivis(input: {
  suivis: readonly ImmeubleSuivi[];
  evenements: ReadonlyMap<string, EvenementsImmeuble>;
  now?: Date;
}): ProposedAction[] {
  const now = input.now ?? new Date();
  const out: ProposedAction[] = [];

  for (const s of input.suivis) {
    const ev = input.evenements.get(s.parcelleId);
    if (!ev) continue;
    const payload = { parcelleId: s.parcelleId, banId: s.banId };
    const propositions: ProposedAction[] = [];

    for (const a of ev.audits) {
      if (a.date < s.creeLe.slice(0, 10)) continue;
      const classes = a.classeActuelle
        ? a.classeVisee
          ? `${a.classeActuelle} → ${a.classeVisee} après travaux`
          : `classé ${a.classeActuelle}`
        : null;
      propositions.push({
        kind: 'immeuble_suivi',
        dedupKey: dedupKey('immeuble_suivi', s.parcelleId, 'audit', a.numero),
        titre: `${lieu(s)} : audit énergétique`,
        detail: [classes, 'Exigé avant de vendre une passoire, ou avant une rénovation aidée : le propriétaire bouge.']
          .filter(Boolean)
          .join('. '),
        payload,
        score: clampScore(92),
        assignedTo: s.profileId,
        expiresAt: expiresInDays(EXPIRATION_JOURS, now),
      });
    }

    for (const d of ev.dpe) {
      if (d.creeLe < s.creeLe) continue;
      const lettre = parseDpeLetter(d.etiquette);
      const logement = decrireLogement(d.etage, d.surface);
      propositions.push({
        kind: 'immeuble_suivi',
        dedupKey: dedupKey('immeuble_suivi', s.parcelleId, 'dpe', d.numero ?? `${d.date}-${d.surface}-${d.etage}`),
        titre: `${lieu(s)} : nouveau DPE${lettre ? ` (${lettre})` : ''}`,
        detail: [logement, 'Un DPE se fait avant une vente ou une location : à vérifier avant les autres agences.']
          .filter(Boolean)
          .join('. '),
        payload,
        score: clampScore(lettre === 'F' || lettre === 'G' ? 90 : 85),
        assignedTo: s.profileId,
        expiresAt: expiresInDays(EXPIRATION_JOURS, now),
      });
    }

    for (const v of ev.ventes) {
      if (v.creeLe < s.creeLe) continue;
      const bien = [
        v.typeLocal === 'Appartement' && v.pieces ? `T${v.pieces}` : v.typeLocal,
        v.surface ? `${Math.round(v.surface)} m²` : null,
        v.prix ? euros(v.prix) : null,
      ]
        .filter(Boolean)
        .join(' · ');
      propositions.push({
        kind: 'immeuble_suivi',
        dedupKey: dedupKey('immeuble_suivi', s.parcelleId, 'vente', `${v.date}-${v.prix ?? ''}-${v.surface ?? ''}`),
        titre: `${lieu(s)} : vente enregistrée`,
        detail: [bien, `Acte du ${v.date.split('-').reverse().join('/')}. Une vente dans l’immeuble fait réfléchir les voisins.`]
          .filter(Boolean)
          .join('. '),
        payload,
        score: clampScore(70),
        assignedTo: s.profileId,
        expiresAt: expiresInDays(EXPIRATION_JOURS, now),
      });
    }

    out.push(...propositions.sort((x, y) => y.score - x.score).slice(0, PAR_IMMEUBLE));
  }
  return out;
}
