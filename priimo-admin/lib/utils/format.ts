import type { InvitationRow, LeadRow, LeadSignalsPayloadJson } from '@/lib/types/database';

export const INVITE_BASE_URL = 'https://www.priimo.fr/invite';

export function buildInviteUrl(token: string): string {
  return `${INVITE_BASE_URL}?token=${encodeURIComponent(token)}`;
}

export type InvitationStatus = 'active' | 'expired' | 'used';

export function getInvitationStatus(row: Pick<InvitationRow, 'used_at' | 'expires_at'>): InvitationStatus {
  if (row.used_at) return 'used';
  if (new Date(row.expires_at) <= new Date()) return 'expired';
  return 'active';
}

export function extractMainSignal(signals: LeadSignalsPayloadJson): string {
  if (Array.isArray(signals)) {
    return signals[0]?.label ?? '—';
  }
  if (signals?.main_signal_label) return signals.main_signal_label;
  return signals?.details?.[0]?.label ?? '—';
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(iso));
}

export function formatNumber(n: number, digits = 0): string {
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(n);
}

export function formatPercent(n: number): string {
  return `${formatNumber(n, 1)} %`;
}

export const LEAD_STATUS_LABELS: Record<LeadRow['status'], string> = {
  nouveau: 'Nouveau',
  contacte: 'Contacté',
  interesse: 'Intéressé',
  pas_interesse: 'Pas intéressé',
  mandat_signe: 'Mandat signé',
  vendeur_ailleurs: 'Vendeur ailleurs',
};

export const ML_FEEDBACK_LABELS: Record<string, string> = {
  mandat_signe: 'Mandat signé',
  vendeur_perdu: 'Vendeur mais perdu',
  pas_vendeur: 'Pas vendeur',
  injoignable: 'Injoignable',
};

/**
 * Couleurs du donut feedback ML.
 * Défini ici (module neutre) et NON dans le composant `'use client'` :
 * un server component qui importe une valeur d'un module client reçoit une
 * référence non sérialisable au lieu de la valeur réelle.
 */
export const ML_FEEDBACK_COLORS: Record<string, string> = {
  mandat_signe: '#10b981', // emerald — signé
  vendeur_perdu: '#f59e0b', // amber — perdu
  pas_vendeur: '#6366f1', // indigo — pas vendeur
  injoignable: '#ef4444', // red — injoignable
  aucun: '#3f3f52', // gris — aucun résultat
};

export const OWNER_TYPE_LABELS: Record<LeadRow['owner_type'], string> = {
  particulier: 'Particulier',
  entreprise: 'SCI / Entreprise',
};

export const PLAN_LABELS: Record<string, string> = {
  fondateur: 'Fondateur',
  standard: 'Standard',
  premium: 'Premium',
  reseau: 'Réseau',
};

export const ROLE_LABELS: Record<string, string> = {
  directeur: 'Directeur',
  collaborateur: 'Collaborateur',
};

/** Délai de relance fondateur après inscription d'un directeur. */
export const DIRECTOR_FOLLOWUP_DAYS = 14;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * `overdue`/`due` : la relance doit être faite (en retard ou aujourd'hui).
 * `soon` : relance dans les 3 prochains jours — à anticiper.
 * `upcoming` : relance plus lointaine.
 */
export type DirectorFollowupStatus = 'overdue' | 'due' | 'soon' | 'upcoming';

/** Statuts pour lesquels une action de relance est effectivement attendue. */
export const ACTIONABLE_FOLLOWUP_STATUSES: DirectorFollowupStatus[] = ['overdue', 'due', 'soon'];

export function getDirectorFollowupInfo(registeredAt: string): {
  followupAt: Date;
  status: DirectorFollowupStatus;
  diffDays: number;
  label: string;
  shortLabel: string;
} {
  const registered = new Date(registeredAt);
  const followupAt = new Date(registered.getTime() + DIRECTOR_FOLLOWUP_DAYS * MS_PER_DAY);

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfFollowup = new Date(
    followupAt.getFullYear(),
    followupAt.getMonth(),
    followupAt.getDate(),
  );
  const diffDays = Math.floor((startOfFollowup.getTime() - startOfToday.getTime()) / MS_PER_DAY);

  const dateLabel = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short' }).format(followupAt);

  if (diffDays < 0) {
    const overdue = Math.abs(diffDays);
    return {
      followupAt,
      status: 'overdue',
      diffDays,
      label: overdue === 1 ? 'À relancer · en retard de 1 j' : `À relancer · en retard de ${overdue} j`,
      shortLabel: overdue === 1 ? 'Retard 1 j' : `Retard ${overdue} j`,
    };
  }

  if (diffDays === 0) {
    return {
      followupAt,
      status: 'due',
      diffDays,
      label: 'À relancer aujourd\u2019hui',
      shortLabel: 'Aujourd\u2019hui',
    };
  }

  if (diffDays === 1) {
    return { followupAt, status: 'soon', diffDays, label: 'À relancer demain', shortLabel: 'Demain' };
  }

  if (diffDays <= 3) {
    return {
      followupAt,
      status: 'soon',
      diffDays,
      label: `À relancer dans ${diffDays} j`,
      shortLabel: `Dans ${diffDays} j`,
    };
  }

  return {
    followupAt,
    status: 'upcoming',
    diffDays,
    label: `Relance le ${dateLabel}`,
    shortLabel: dateLabel,
  };
}
