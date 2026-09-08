import { dateKeyParis, startOfWeekYmd, ymdKey, type Ymd } from '@/lib/today/calendar';
import type { AgendaEvenement } from './types';

function decale(parts: Ymd, delta: number): Ymd {
  const utc = Date.UTC(parts.y, parts.m - 1, parts.d + delta, 12, 0, 0);
  const d = new Date(utc);
  return {
    y: d.getUTCFullYear(),
    m: d.getUTCMonth() + 1,
    d: d.getUTCDate(),
    weekday: d.getUTCDay(),
  };
}

export type JourAgenda = {
  cle: string;
  label: string;
  aujourdhui: boolean;
};

/** Lundi → dimanche, libellés « Lun. 7 ». */
export function joursDeLaSemaine(date: Date, aujourdhui: string): JourAgenda[] {
  const lundi = startOfWeekYmd(date);
  const out: JourAgenda[] = [];
  for (let i = 0; i < 7; i += 1) {
    const jour = decale(lundi, i);
    const cle = ymdKey(jour);
    const utc = new Date(Date.UTC(jour.y, jour.m - 1, jour.d, 12, 0, 0));
    const weekday = new Intl.DateTimeFormat('fr-FR', {
      weekday: 'short',
      timeZone: 'UTC',
    }).format(utc);
    const cap = weekday.charAt(0).toLocaleUpperCase('fr-FR') + weekday.slice(1);
    out.push({
      cle,
      label: `${cap} ${jour.d}`,
      aujourdhui: cle === aujourdhui,
    });
  }
  return out;
}

function heureParis(date: Date): number {
  return Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Paris',
      hour: 'numeric',
      hourCycle: 'h23',
    }).format(date),
  );
}

/** Minuit Europe/Paris du jour civil, en ISO UTC. */
export function minuitParisIso(ymd: string): string {
  for (const off of ['+02:00', '+01:00'] as const) {
    const date = new Date(`${ymd}T00:00:00${off}`);
    if (dateKeyParis(date) === ymd && heureParis(date) === 0) {
      return date.toISOString();
    }
  }
  return new Date(`${ymd}T00:00:00+01:00`).toISOString();
}

/** [lundi 00:00, lundi suivant 00:00) en Europe/Paris. */
export function bornesIsoSemaine(date: Date): { timeMin: string; timeMax: string } {
  const lundi = startOfWeekYmd(date);
  const lundiSuivant = decale(lundi, 7);
  return {
    timeMin: minuitParisIso(ymdKey(lundi)),
    timeMax: minuitParisIso(ymdKey(lundiSuivant)),
  };
}

export function grouperParJour(
  evenements: readonly AgendaEvenement[],
): Record<string, AgendaEvenement[]> {
  const out: Record<string, AgendaEvenement[]> = {};
  for (const ev of evenements) {
    const liste = out[ev.jour] ?? [];
    liste.push(ev);
    out[ev.jour] = liste;
  }
  return out;
}
