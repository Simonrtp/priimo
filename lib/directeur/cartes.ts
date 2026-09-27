import { DIRECTEUR_SEUILS, type DirecteurSeuils } from './config';
import { imminenceJoursRestants, scoreCarte } from '@/lib/today/scoring';
import {
  joursAvantExpirationMandat,
  imminenceExpirationMandat,
} from '@/lib/metier/mandat';

export type DirecteurCarteType =
  | 'decrochage'
  | 'estimation_sans_relance'
  | 'mandat_fin_validite'
  | 'mandat_vieillit'
  | 'prospects_sans_negociateur';

/** Ordre de tri des types (plus urgent d'abord). */
export const ORDRE_TYPE_DIRECTEUR: readonly DirecteurCarteType[] = [
  'mandat_fin_validite',
  'decrochage',
  'estimation_sans_relance',
  'mandat_vieillit',
  'prospects_sans_negociateur',
] as const;

export const ENJEU_TYPE_DIRECTEUR: Record<DirecteurCarteType, number> = {
  mandat_fin_validite: 92,
  decrochage: 85,
  estimation_sans_relance: 78,
  mandat_vieillit: 70,
  prospects_sans_negociateur: 60,
};

export type DirecteurCarteAction = 'preparer' | 'assigner';

export type DirecteurCarte = {
  key: string;
  type: DirecteurCarteType;
  /** Négociateur concerné, si applicable. */
  membreId: string | null;
  prenom: string | null;
  texte: string;
  repere: string | null;
  action: DirecteurCarteAction;
  enjeu: number;
  imminence: number;
  score: number;
  /** Pour liens / panneau. */
  href: string | null;
  meta?: Record<string, string | number | boolean | null>;
};

export type ActiviteMembre = {
  membreId: string;
  prenom: string;
  /** Unités d'activité sur les 7 derniers jours. */
  activite7j: number;
  /** Jours depuis la dernière unité d'activité (null = jamais). */
  joursSansActivite: number | null;
  /** Moyenne hebdo des 4 semaines précédentes (null si historique insuffisant). */
  moyenneHebdo4s: number | null;
  semainesHistorique: number;
};

export type EstimationSansRelanceInput = {
  id: string;
  membreId: string | null;
  prenom: string | null;
  clientLabel: string;
  envoyeIlYaJours: number;
  consulteIlYaJours: number | null;
};

export type MandatDirecteurInput = {
  id: string;
  address: string;
  membreId: string | null;
  prenom: string | null;
  mandatSigneLe: string;
  mandatDureeMois: number;
  visitCount: number;
};

export type ProspectsSansNegociateurInput = {
  count: number;
};

function base(
  partial: Omit<DirecteurCarte, 'enjeu' | 'imminence' | 'score'>,
  enjeu: number,
  imminence: number,
): DirecteurCarte {
  return {
    ...partial,
    enjeu,
    imminence,
    score: scoreCarte(enjeu, imminence),
  };
}

/** Décrochage : activité 7j < 50 % de la moyenne des 4 semaines précédentes. */
export function cartesDecrochage(
  membres: readonly ActiviteMembre[],
  seuils: Pick<
    DirecteurSeuils,
    'decrochageSemainesHistorique' | 'decrochageSeuilRatio'
  > = DIRECTEUR_SEUILS,
): DirecteurCarte[] {
  const out: DirecteurCarte[] = [];
  for (const m of membres) {
    if (m.semainesHistorique < seuils.decrochageSemainesHistorique) continue;
    if (m.moyenneHebdo4s == null || m.moyenneHebdo4s <= 0) continue;
    if (m.activite7j >= m.moyenneHebdo4s * seuils.decrochageSeuilRatio) continue;

    const baisse = Math.round((1 - m.activite7j / m.moyenneHebdo4s) * 100);
    const silence = m.joursSansActivite != null && m.joursSansActivite >= 3;
    const texte = silence
      ? `${m.prenom} ne note plus rien depuis ${m.joursSansActivite} jours`
      : `L'activité de ${m.prenom} a baissé de ${baisse} %`;
    const moyenneArr = Math.round(m.moyenneHebdo4s * 10) / 10;
    const imminence =
      m.joursSansActivite == null
        ? 55
        : Math.min(100, 40 + m.joursSansActivite * 8);

    out.push(
      base(
        {
          key: `decrochage:${m.membreId}`,
          type: 'decrochage',
          membreId: m.membreId,
          prenom: m.prenom,
          texte,
          repere: `contre ${moyenneArr} par semaine d'habitude`,
          action: 'preparer',
          href: null,
          meta: { baisse, moyenne: moyenneArr },
        },
        ENJEU_TYPE_DIRECTEUR.decrochage,
        imminence,
      ),
    );
  }
  return out;
}

export function cartesEstimationSansRelance(
  rows: readonly EstimationSansRelanceInput[],
  seuils: Pick<DirecteurSeuils, 'estimationSansRelanceJours'> = DIRECTEUR_SEUILS,
): DirecteurCarte[] {
  const out: DirecteurCarte[] = [];
  for (const row of rows) {
    if (row.envoyeIlYaJours < seuils.estimationSansRelanceJours) continue;
    const consulte =
      row.consulteIlYaJours != null
        ? `${row.clientLabel} a consulté l'avis de valeur il y a ${row.consulteIlYaJours} jour${row.consulteIlYaJours > 1 ? 's' : ''}, pas de relance`
        : `Avis de valeur envoyé à ${row.clientLabel} il y a ${row.envoyeIlYaJours} jours, pas de relance`;
    out.push(
      base(
        {
          key: `estimation_sans_relance:${row.id}`,
          type: 'estimation_sans_relance',
          membreId: row.membreId,
          prenom: row.prenom,
          texte: consulte,
          repere: null,
          action: 'preparer',
          href: `/dashboard/estimation?id=${encodeURIComponent(row.id)}`,
          meta: { estimationId: row.id },
        },
        ENJEU_TYPE_DIRECTEUR.estimation_sans_relance,
        Math.min(100, 50 + (row.envoyeIlYaJours - seuils.estimationSansRelanceJours) * 5),
      ),
    );
  }
  return out;
}

export function cartesMandatFinValidite(
  mandats: readonly MandatDirecteurInput[],
  now: Date,
  seuils: Pick<DirecteurSeuils, 'mandatFinValiditeJours'> = DIRECTEUR_SEUILS,
): DirecteurCarte[] {
  const out: DirecteurCarte[] = [];
  for (const m of mandats) {
    const jours = joursAvantExpirationMandat(m.mandatSigneLe, m.mandatDureeMois, now);
    if (jours > seuils.mandatFinValiditeJours) continue;
    const texte =
      jours <= 0
        ? `Mandat expiré — ${m.address}`
        : `Mandat en fin de validité dans ${jours} jour${jours > 1 ? 's' : ''} — ${m.address}`;
    out.push(
      base(
        {
          key: `mandat_fin:${m.id}`,
          type: 'mandat_fin_validite',
          membreId: m.membreId,
          prenom: m.prenom,
          texte,
          repere: m.prenom ? `porté par ${m.prenom}` : null,
          action: 'preparer',
          href: `/dashboard/biens?id=${encodeURIComponent(m.id)}`,
          meta: { bienId: m.id, joursRestants: jours },
        },
        ENJEU_TYPE_DIRECTEUR.mandat_fin_validite,
        imminenceExpirationMandat(jours),
      ),
    );
  }
  return out;
}

export function cartesMandatVieillit(
  mandats: readonly MandatDirecteurInput[],
  now: Date,
  seuils: Pick<
    DirecteurSeuils,
    'mandatVieillitJours' | 'mandatVieillitVisitesMax'
  > = DIRECTEUR_SEUILS,
): DirecteurCarte[] {
  const out: DirecteurCarte[] = [];
  const nowMs = now.getTime();
  for (const m of mandats) {
    const signe = Date.parse(`${m.mandatSigneLe}T12:00:00.000Z`);
    if (!Number.isFinite(signe)) continue;
    const ageJours = Math.floor((nowMs - signe) / 86_400_000);
    if (ageJours < seuils.mandatVieillitJours) continue;
    if (m.visitCount >= seuils.mandatVieillitVisitesMax) continue;
    out.push(
      base(
        {
          key: `mandat_vieillit:${m.id}`,
          type: 'mandat_vieillit',
          membreId: m.membreId,
          prenom: m.prenom,
          texte: `Mandat actif depuis ${ageJours} jours avec ${m.visitCount} visite${m.visitCount > 1 ? 's' : ''} — ${m.address}`,
          repere: m.prenom ? `porté par ${m.prenom}` : null,
          action: 'preparer',
          href: `/dashboard/biens?id=${encodeURIComponent(m.id)}`,
          meta: { bienId: m.id, ageJours, visitCount: m.visitCount },
        },
        ENJEU_TYPE_DIRECTEUR.mandat_vieillit,
        imminenceJoursRestants(
          Math.max(0, seuils.mandatVieillitJours * 2 - ageJours),
          seuils.mandatVieillitJours,
        ),
      ),
    );
  }
  return out;
}

export function carteProspectsSansNegociateur(
  input: ProspectsSansNegociateurInput,
  seuils: Pick<DirecteurSeuils, 'prospectsSansNegociateurJours'> = DIRECTEUR_SEUILS,
): DirecteurCarte[] {
  if (input.count <= 0) return [];
  const n = input.count;
  return [
    base(
      {
        key: 'prospects_sans_negociateur',
        type: 'prospects_sans_negociateur',
        membreId: null,
        prenom: null,
        texte:
          n === 1
            ? `1 prospect sans négociateur depuis plus de ${seuils.prospectsSansNegociateurJours} jours`
            : `${n} prospects sans négociateur depuis plus de ${seuils.prospectsSansNegociateurJours} jours`,
        repere: null,
        action: 'assigner',
        href: '/dashboard/prospection?filtre=non-assignes-14j&vue=liste',
        meta: { count: n },
      },
      ENJEU_TYPE_DIRECTEUR.prospects_sans_negociateur,
      Math.min(100, 40 + n * 5),
    ),
  ];
}

export function trierCartesDirecteur(cartes: readonly DirecteurCarte[]): DirecteurCarte[] {
  const rangType = new Map(ORDRE_TYPE_DIRECTEUR.map((t, i) => [t, i]));
  return [...cartes].sort((a, b) => {
    const ta = rangType.get(a.type) ?? 99;
    const tb = rangType.get(b.type) ?? 99;
    if (ta !== tb) return ta - tb;
    if (b.score !== a.score) return b.score - a.score;
    return a.key.localeCompare(b.key, 'fr');
  });
}

export function construireCartesDirecteur(input: {
  activites: readonly ActiviteMembre[];
  estimations: readonly EstimationSansRelanceInput[];
  mandats: readonly MandatDirecteurInput[];
  prospectsSansNegociateur: number;
  now?: Date;
  seuils?: DirecteurSeuils;
}): DirecteurCarte[] {
  const seuils = input.seuils ?? DIRECTEUR_SEUILS;
  const now = input.now ?? new Date();
  return trierCartesDirecteur([
    ...cartesMandatFinValidite(input.mandats, now, seuils),
    ...cartesDecrochage(input.activites, seuils),
    ...cartesEstimationSansRelance(input.estimations, seuils),
    ...cartesMandatVieillit(input.mandats, now, seuils),
    ...carteProspectsSansNegociateur(
      { count: input.prospectsSansNegociateur },
      seuils,
    ),
  ]);
}

export function plafonnerCartesDirecteur(
  cartes: readonly DirecteurCarte[],
  max = DIRECTEUR_SEUILS.cartesZone1Max,
): { visibles: DirecteurCarte[]; reste: number } {
  if (cartes.length <= max) return { visibles: [...cartes], reste: 0 };
  return { visibles: cartes.slice(0, max), reste: cartes.length - max };
}
