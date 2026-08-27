import type { TodayCard, TodayCardType } from '@/lib/today/cards';
import { ENJEU_PAR_TYPE, scoreCarte } from '@/lib/today/scoring';

export const MAX_CARTES_AFFICHEES = 7;
export const MAX_CARTES_PAR_TYPE = 3;

const GROUP_LABELS: Partial<Record<TodayCardType, (n: number) => string>> = {
  demande_portail: (n) => `${n} demandes portail`,
  estimation_vuee: (n) => `${n} avis consultés`,
  relance: (n) => `${n} relances en attente`,
  promesse: (n) => `${n} promesses en attente`,
  post_visite: (n) => `${n} comptes rendus en attente`,
  rapprochement: (n) => `${n} rapprochements à traiter`,
};

function groupCard(type: TodayCardType, cards: TodayCard[]): TodayCard {
  const top = cards[0]!;
  const enjeu = ENJEU_PAR_TYPE[type];
  const imminence = Math.max(...cards.map((c) => c.imminence));
  const labelFn = GROUP_LABELS[type];
  const headline = labelFn ? labelFn(cards.length) : `${cards.length} actions en attente`;
  const score = scoreCarte(enjeu, imminence);
  return {
    key: `groupe:${type}`,
    type,
    headline,
    context: 'Voir la liste complète',
    action: { kind: 'ouvrir_liste', label: 'Voir tout', cardType: type },
    enjeu,
    imminence,
    score,
    dismissible: type !== 'echeance_contractuelle',
    priority: 5000 - score,
    urgent: cards.some((c) => c.urgent),
    groupedKeys: cards.map((c) => c.key),
    geo: top.geo ?? null,
  };
}

/**
 * Plafond à 7 cartes : au-delà de 3 du même type, regroupement en une carte liste.
 */
export function plafonnerEtRegrouper(cards: readonly TodayCard[]): TodayCard[] {
  const sorted = [...cards].sort((a, b) => b.score - a.score);
  const byType = new Map<TodayCardType, TodayCard[]>();
  for (const c of sorted) {
    const list = byType.get(c.type) ?? [];
    list.push(c);
    byType.set(c.type, list);
  }

  const merged: TodayCard[] = [];
  for (const [type, list] of byType) {
    const individuelles = list.slice(0, MAX_CARTES_PAR_TYPE);
    merged.push(...individuelles);
    if (list.length > MAX_CARTES_PAR_TYPE) {
      merged.push(groupCard(type, list));
    }
  }

  merged.sort((a, b) => b.score - a.score);

  return merged.slice(0, MAX_CARTES_AFFICHEES).sort((a, b) => b.score - a.score);
}
