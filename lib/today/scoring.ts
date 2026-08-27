import type { TodayCardType } from '@/lib/today/cards';

/** Enjeu métier de base par type de carte (0–100). */
export const ENJEU_PAR_TYPE: Record<TodayCardType, number> = {
  demande_portail: 92,
  estimation_vuee: 88,
  echeance_contractuelle: 90,
  alerte: 80,
  post_visite: 70,
  mandat_sans_visite: 65,
  promesse: 60,
  rapprochement: 55,
  rendez_vous: 50,
  transmis: 45,
  relance: 40,
  nouvelle_adresse: 30,
};

export function scoreCarte(enjeu: number, imminence: number): number {
  return Math.round(Math.max(0, Math.min(100, enjeu)) * Math.max(0, Math.min(100, imminence)));
}

/** Imminence décroissante après N heures depuis un événement. */
export function imminenceFenetreHeures(heuresEcoulees: number, maxHeures: number): number {
  if (heuresEcoulees < 0) return 100;
  if (heuresEcoulees >= maxHeures) return 0;
  return Math.round(100 * (1 - heuresEcoulees / maxHeures));
}

export function imminenceJoursRestants(joursRestants: number, fenetreJours: number): number {
  if (joursRestants <= 0) return 100;
  if (joursRestants > fenetreJours) return 0;
  return Math.round(100 * (1 - joursRestants / fenetreJours));
}

export function imminenceRendezVous(debutIso: string, finIso: string, now: Date): number {
  const debut = Date.parse(debutIso);
  const fin = Date.parse(finIso);
  const t = now.getTime();
  if (Number.isNaN(debut) || Number.isNaN(fin)) return 50;
  if (t >= fin) return 0;
  if (t >= debut && t < fin) return 100;
  const heuresAvant = (debut - t) / 3_600_000;
  if (heuresAvant <= 2) return 95;
  if (heuresAvant <= 24) return 80;
  return 40;
}

export function heuresDepuis(iso: string, now: Date): number {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return Infinity;
  return (now.getTime() - t) / 3_600_000;
}

export function sameDayParis(iso: string, now: Date): boolean {
  const d = new Date(iso);
  const fmt = (x: Date) =>
    new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(x);
  return fmt(d) === fmt(now);
}
