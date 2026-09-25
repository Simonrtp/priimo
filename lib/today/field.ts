import type { TodayCard, TodayCardType } from '@/lib/today/cards';
import { toGeoCoord } from '@/lib/carte/coords';

/** Palette terrain — aucun violet. */
export const FIELD = {
  orange: '#E8743C',
  ardoise: '#1A2A56',
  vert: '#2E7D5B',
  rouge: '#C4483C',
  creme: '#FFF7F0',
  /** Pastels terrain (mobile, swipe…) — plus affirmés qu’avant. */
  orangePastel: '#F5D4C4',
  ardoisePastel: '#D5D8E4',
  vertPastel: '#C9EEDA',
  rougePastel: '#F0C4BE',
} as const;

/**
 * Accueil — pastels KPI (1 couleur fixe par métrique). Texte noir dessus.
 */
export const ACCUEIL = {
  vert: '#C9EEDA',
  jaune: '#FFFAC2',
  creme: '#FFF9EB',
  bleu: '#D5D8E4',
  orange: '#FFE0C4',
} as const;

export type AccueilAccent = keyof typeof ACCUEIL;

/** Boutons KPI — même teinte que le fond, plus foncée. */
export const ACCUEIL_DARK: Record<AccueilAccent, string> = {
  vert: '#8CCFA8',
  jaune: '#EDE07A',
  creme: '#E5D9BC',
  bleu: '#8A93C4',
  orange: '#E8BE98',
};

/** Fond shell dashboard (sidebar / header desktop). */
export const SHELL_GRADIENT = 'linear-gradient(180deg, #1A2A56 0%, #1A2A56 100%)';

/** Classe CSS : dégradé bleu + grain discret (voir globals.css `.priimo-shell-bg`). */
export const SHELL_BG_CLASS = 'priimo-shell-bg';

/**
 * Jours ouvrés de l'agence, `Date.getDay()` : 0 = dimanche.
 * Défaut lundi–samedi : un dimanche ne casse jamais la série.
 */
export const TODAY_WORKDAYS: readonly number[] = [1, 2, 3, 4, 5, 6];

export const TODAY_WEEK_NOTE_GOAL = 10;
export const TOURNEE_RADIUS_M = 800;

export type FieldGeo = {
  latitude: number;
  longitude: number;
  address: string;
};

export function geoFrom(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
  address: string | null | undefined,
): FieldGeo | null {
  const coord = toGeoCoord(latitude, longitude);
  const label = (address ?? '').trim();
  if (!coord || !label) return null;
  return { ...coord, address: label };
}

export function dotColorFor(type: TodayCardType): string {
  switch (type) {
    case 'echeance_contractuelle':
      return FIELD.rouge;
    case 'post_visite':
      return FIELD.ardoise;
    case 'promesse':
      return FIELD.orange;
    case 'mandat_sans_visite':
      return FIELD.ardoise;
    case 'relance':
      return FIELD.orange;
    case 'nouvelle_adresse':
      return FIELD.ardoise;
    case 'rapprochement':
      return FIELD.vert;
    case 'transmis':
      return FIELD.ardoise;
    case 'alerte':
      return FIELD.rouge;
    case 'rendez_vous':
      return FIELD.ardoise;
    case 'demande_estimation':
      return FIELD.vert;
    case 'demande_portail':
      return FIELD.orange;
    case 'estimation_vuee':
      return FIELD.vert;
  }
}

export function pastelFor(type: TodayCardType): string {
  switch (type) {
    case 'echeance_contractuelle':
      return FIELD.rougePastel;
    case 'post_visite':
    case 'mandat_sans_visite':
    case 'nouvelle_adresse':
    case 'rendez_vous':
      return FIELD.ardoisePastel;
    case 'promesse':
    case 'relance':
    case 'demande_portail':
      return FIELD.orangePastel;
    case 'rapprochement':
    case 'demande_estimation':
    case 'estimation_vuee':
      return FIELD.vertPastel;
    case 'transmis':
      return FIELD.creme;
    case 'alerte':
      return FIELD.rougePastel;
  }
}

/** Libellé court du bouton plein. Chaque carte en a un. */
export function phraseNotesReturn(relances: number, rapprochements: number): string | null {
  if (relances <= 0 && rapprochements <= 0) return null;
  const parts: string[] = [];
  if (relances > 0) {
    parts.push(
      `${relances} relance${relances > 1 ? 's' : ''} programmée${relances > 1 ? 's' : ''}`,
    );
  }
  if (rapprochements > 0) {
    parts.push(`${rapprochements} rapprochement${rapprochements > 1 ? 's' : ''}`);
  }
  return `Tes notes cette semaine : ${parts.join(' · ')}`;
}

/** Libellé court du bouton plein. Chaque carte en a un. */
export function ctaCourt(card: TodayCard): string {
  if (card.action.kind === 'appeler') return 'Appeler';
  if (card.action.kind === 'voir_acquereurs') return 'Voir les acquéreurs';
  if (card.action.kind === 'ouvrir_bien') return 'Ouvrir';
  if (card.action.kind === 'ouvrir_liste') return 'Voir tout';
  if (card.type === 'nouvelle_adresse' && card.geo) return 'Y aller';
  return 'Ouvrir';
}

/** Libellé discret pour les cartes niveau 3 (lien texte). */
export function ctaLink(card: TodayCard): string {
  if (card.action.kind === 'appeler') return 'Appeler';
  if (card.type === 'nouvelle_adresse' && card.geo) return 'Y aller';
  return card.action.label;
}

export function phraseEtat({
  remaining,
  prenom,
  emptyKind,
}: {
  remaining: number;
  prenom: string;
  emptyKind: 'bouclee' | 'rien' | null;
}): string {
  if (emptyKind === 'rien') return 'Rien de prévu aujourd’hui';
  if (emptyKind === 'bouclee' || remaining === 0) return 'Journée bouclée.';
  if (remaining <= 2) return `Plus que ${remaining}.`;
  const name = prenom.trim();
  return name ? `Bonjour ${name}. ${remaining} à traiter.` : `Bonjour. ${remaining} à traiter.`;
}

export function snoozeUntil(kind: 'demain' | 'trois_jours' | 'semaine', now = new Date()): Date {
  const until = new Date(now);
  until.setHours(6, 0, 0, 0);
  if (kind === 'demain') {
    until.setDate(until.getDate() + 1);
    return until;
  }
  if (kind === 'trois_jours') {
    until.setDate(until.getDate() + 3);
    return until;
  }
  const day = until.getDay();
  const daysToMonday = day === 0 ? 1 : 8 - day;
  until.setDate(until.getDate() + daysToMonday);
  return until;
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  const km = meters / 1000;
  return `${km.toLocaleString('fr-FR', { maximumFractionDigits: 1, minimumFractionDigits: 1 })} km`;
}

const CARDINAUX = [
  'Nord',
  'Nord-Est',
  'Est',
  'Sud-Est',
  'Sud',
  'Sud-Ouest',
  'Ouest',
  'Nord-Ouest',
] as const;

export function bearingDegrees(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
): number {
  const φ1 = (from.latitude * Math.PI) / 180;
  const φ2 = (to.latitude * Math.PI) / 180;
  const Δλ = ((to.longitude - from.longitude) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (Math.atan2(y, x) * 180) / Math.PI;
}

export function cardinalFrom(deg: number): string {
  const n = ((deg % 360) + 360) % 360;
  const i = Math.round(n / 45) % 8;
  return CARDINAUX[i] ?? 'Nord';
}

export function mapsItineraireUrl(latitude: number, longitude: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
}
