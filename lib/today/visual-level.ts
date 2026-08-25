import type { TodayCard } from '@/lib/today/cards';

export const SCORE_BURN = 6000;
export const SCORE_ROUTINE = 2000;

export type VisualLevel = 1 | 2 | 3;

export function visualLevel(card: Pick<TodayCard, 'score'>): VisualLevel {
  if (card.score > SCORE_BURN) return 1;
  if (card.score >= SCORE_ROUTINE) return 2;
  return 3;
}

/** Rouge réservé aux dépassements — jamais pour « bientôt ». */
export function isOverdue(card: TodayCard): boolean {
  if (card.type === 'promesse' && card.context.startsWith('En retard')) return true;
  if (card.type === 'echeance_contractuelle') {
    const c = card.context.toLowerCase();
    return c.includes('expiré') || c.includes('expirée');
  }
  return false;
}

/** Mention temporelle explicite pour le niveau 1 (haut droite). */
export function temporalMention(card: TodayCard): string | null {
  if (visualLevel(card) !== 1) return null;

  if (card.type === 'promesse') {
    if (card.context.startsWith('En retard')) {
      const m = card.context.match(/(\d+)\s+jour/);
      if (m) {
        const n = Number(m[1]);
        return `En retard de ${n} jour${n > 1 ? 's' : ''}`;
      }
      return 'En retard';
    }
    if (card.context === "Aujourd'hui") return "Aujourd'hui";
  }

  if (card.type === 'echeance_contractuelle') {
    const c = card.context;
    if (/expiré/i.test(c)) return 'Expiré';
    const m = c.match(/expire dans (\d+) jour/i);
    if (m) {
      const n = Number(m[1]);
      return `Expire dans ${n} jour${n > 1 ? 's' : ''}`;
    }
    if (/aujourd'hui/i.test(c)) return "Expire aujourd'hui";
    const offre = c.match(/expire (?:dans (\d+) j|aujourd'hui)/i);
    if (offre) {
      if (offre[0].includes("aujourd'hui")) return "Expire aujourd'hui";
      const n = Number(offre[1]);
      if (n >= 0) return `Expire dans ${n} jour${n > 1 ? 's' : ''}`;
    }
  }

  if (card.type === 'rendez_vous' && card.context.startsWith("Aujourd'hui")) {
    return "Aujourd'hui";
  }

  return null;
}

export function parisHour(now: Date): number {
  const parts = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    hour: 'numeric',
    hour12: false,
  }).formatToParts(now);
  const h = parts.find((p) => p.type === 'hour')?.value;
  return h ? Number(h) : now.getHours();
}

export function isAfternoonProspectionMoment(now: Date): boolean {
  return parisHour(now) >= 13;
}

export function level1ContextLine(cards: readonly TodayCard[]): string | null {
  const burns = cards.filter((c) => visualLevel(c) === 1);
  if (burns.length <= 3) return null;
  const echeances = burns.filter((c) => c.type === 'echeance_contractuelle').length;
  if (echeances >= 2) {
    return `${echeances} échéances cette semaine`;
  }
  return `${burns.length} actions urgentes`;
}

export type TodayLayout = {
  level1: TodayCard[];
  level2: TodayCard[];
  prospection: TodayCard[];
  level3Other: TodayCard[];
  showTourneeProminent: boolean;
  tourneeHint: string | null;
  level1ContextLine: string | null;
  hasRealWork: boolean;
};

function isProspectionCard(card: TodayCard): boolean {
  return card.type === 'nouvelle_adresse';
}

/**
 * Répartit les cartes par niveau visuel et ajuste la place de la tournée
 * selon le moment de la journée.
 */
export function organizeTodayLayout(
  cards: readonly TodayCard[],
  now: Date,
  hasSortie = false,
): TodayLayout {
  const sorted = [...cards].sort((a, b) => b.score - a.score);

  const level1: TodayCard[] = [];
  const level2: TodayCard[] = [];
  const prospection: TodayCard[] = [];
  const level3Other: TodayCard[] = [];

  for (const card of sorted) {
    const lvl = visualLevel(card);
    if (lvl === 1) level1.push(card);
    else if (lvl === 2) level2.push(card);
    else if (isProspectionCard(card)) prospection.push(card);
    else level3Other.push(card);
  }

  const afternoon = isAfternoonProspectionMoment(now);
  const showTourneeProminent = afternoon && hasSortie;

  return {
    level1,
    level2,
    prospection,
    level3Other,
    showTourneeProminent,
    tourneeHint: showTourneeProminent ? 'Bon moment pour sortir' : null,
    level1ContextLine: level1ContextLine(level1),
    hasRealWork: level1.length > 0 || level2.length > 0,
  };
}
