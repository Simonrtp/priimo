import { dateKeyParis } from '@/lib/today/calendar';
import { FIELD } from '@/lib/today/field';

/**
 * Fraîcheur de passage — un immeuble n'est pas prospecté ou à prospecter.
 * Il a une date, et cette date vieillit.
 *
 * Quatre niveaux, palette FIELD. L'orange lead n'y figure pas : un point
 * de fraîcheur ne doit jamais se confondre avec un lead livré.
 */

export const NIVEAUX_FRAICHEUR = ['semaine', 'cycle', 'revoir', 'jamais'] as const;
export type NiveauFraicheur = (typeof NIVEAUX_FRAICHEUR)[number];
export type FiltreFraicheur = NiveauFraicheur | 'a-revoir';

export function parseNiveauFraicheur(raw: string | undefined): FiltreFraicheur | null {
  if (
    raw === 'semaine' ||
    raw === 'cycle' ||
    raw === 'revoir' ||
    raw === 'jamais' ||
    raw === 'a-revoir'
  ) {
    return raw;
  }
  return null;
}

export function correspondFraicheur(niveau: NiveauFraicheur, filtre: FiltreFraicheur): boolean {
  if (filtre === 'a-revoir') return niveau === 'revoir' || niveau === 'jamais';
  return niveau === filtre;
}

export const LIBELLE_FRAICHEUR: Record<NiveauFraicheur, string> = {
  semaine: 'Passé cette semaine',
  cycle: 'Dans le cycle',
  revoir: 'À revoir',
  jamais: 'Jamais passé',
};

export const COULEUR_FRAICHEUR: Record<NiveauFraicheur, string> = {
  semaine: FIELD.vert,
  cycle: FIELD.ardoise,
  revoir: FIELD.rouge,
  jamais: '#8A8378',
};

/** Repli tant qu'on n'a pas assez d'allers-retours pour calculer un cycle. */
export const CYCLE_DEFAUT_JOURS = 12 * 7;

/** Une adresse remonte à une fois et demie le cycle observé. */
export const MULTIPLICATEUR_REVOIR = 1.5;

/** Au moins trois intervalles, sinon le médian n'est qu'un bruit. */
export const INTERVALLES_MINIMUM = 3;

export type PassageObserve = {
  banId: string;
  profileId: string;
  /** Jour civil parisien YYYY-MM-DD. */
  jour: string;
};

function joursEntre(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  const da = Date.UTC(ay ?? 1970, (am ?? 1) - 1, ad ?? 1);
  const db = Date.UTC(by ?? 1970, (bm ?? 1) - 1, bd ?? 1);
  return Math.round((db - da) / 86_400_000);
}

function mediane(valeurs: readonly number[]): number {
  const tri = [...valeurs].sort((a, b) => a - b);
  const mid = Math.floor(tri.length / 2);
  if (tri.length % 2 === 1) return tri[mid]!;
  return (tri[mid - 1]! + tri[mid]!) / 2;
}

/**
 * Cycle réel d'un négociateur : médiane des intervalles entre deux passages
 * sur une même adresse, sur la fenêtre fournie. Sans assez d'histoire, le
 * repli — jamais affiché comme un réglage de l'agent.
 */
export function cycleObserveJours(
  passages: readonly PassageObserve[],
  profileId: string,
  repliJours: number = CYCLE_DEFAUT_JOURS,
): { jours: number; observe: boolean } {
  const parAdresse = new Map<string, string[]>();
  for (const p of passages) {
    if (p.profileId !== profileId || !p.banId) continue;
    const liste = parAdresse.get(p.banId);
    if (liste) liste.push(p.jour);
    else parAdresse.set(p.banId, [p.jour]);
  }

  const intervalles: number[] = [];
  for (const jours of parAdresse.values()) {
    const uniques = [...new Set(jours)].sort();
    for (let i = 1; i < uniques.length; i += 1) {
      const delta = joursEntre(uniques[i - 1]!, uniques[i]!);
      if (delta > 0) intervalles.push(delta);
    }
  }

  if (intervalles.length < INTERVALLES_MINIMUM) {
    return { jours: Math.max(1, Math.round(repliJours)), observe: false };
  }
  return { jours: Math.max(1, Math.round(mediane(intervalles))), observe: true };
}

export function seuilRevoirJours(cycleJours: number): number {
  return Math.round(cycleJours * MULTIPLICATEUR_REVOIR);
}

export function classerFraicheur(
  dernierJour: string | null,
  maintenant: Date,
  cycleJours: number,
): NiveauFraicheur {
  if (!dernierJour) return 'jamais';
  const age = joursEntre(dernierJour, dateKeyParis(maintenant));
  if (age < 0) return 'semaine';
  if (age <= 7) return 'semaine';
  if (age > seuilRevoirJours(cycleJours)) return 'revoir';
  return 'cycle';
}

export function semainesArrondies(jours: number): number {
  return Math.max(1, Math.round(jours / 7));
}

export function annoterAdresse(params: {
  banId: string | null | undefined;
  id: string;
  derniers: ReadonlyMap<string, string>;
  maintenant: Date;
  cycleJours: number;
}): { dernierPassageJour: string | null; fraicheur: NiveauFraicheur } {
  const cle = (params.banId ?? '').trim() || params.id;
  const jour = params.derniers.get(cle) ?? null;
  return {
    dernierPassageJour: jour,
    fraicheur: classerFraicheur(jour, params.maintenant, params.cycleJours),
  };
}

/** Mention discrète sur un arrêt. Absente si on n'a jamais observé de passage. */
export function mentionDernierPassage(
  jour: string | null | undefined,
  maintenant: Date = new Date(),
): string | null {
  if (!jour) return null;
  const age = joursEntre(jour, dateKeyParis(maintenant));
  if (age <= 7) return null;
  const semaines = semainesArrondies(age);
  return `Dernier passage il y a ${semaines} semaine${semaines > 1 ? 's' : ''}`;
}

/** Dernier passage par immeuble, le plus récent gagne. */
export function dernierPassageParAdresse(
  passages: readonly PassageObserve[],
  profileId: string,
): Map<string, string> {
  const out = new Map<string, string>();
  for (const p of passages) {
    if (p.profileId !== profileId || !p.banId) continue;
    const actuel = out.get(p.banId);
    if (!actuel || p.jour > actuel) out.set(p.banId, p.jour);
  }
  return out;
}
