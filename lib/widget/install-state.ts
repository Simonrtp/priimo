/**
 * Où en est l'installation du widget.
 *
 * Un interrupteur activé ne prouve rien : ce qui compte, c'est de l'avoir vu
 * se charger depuis le site de l'agence. Cette lecture-là est la seule que le
 * directeur doit avoir à faire — installé ou pas, et depuis quand.
 */

export type StatutInstallation = 'jamais_vu' | 'coupe' | 'silencieux' | 'en_ligne';

/** Au-delà, le widget a probablement été retiré du site ou la page déplacée. */
const SILENCE_JOURS = 30;

export type EtatInstallation = {
  statut: StatutInstallation;
  host: string | null;
  lastSeenAt: string | null;
};

export function etatInstallation(
  widget: { enabled: boolean; lastSeenAt: string | null; lastSeenHost: string | null },
  now: Date = new Date(),
): EtatInstallation {
  const base = { host: widget.lastSeenHost, lastSeenAt: widget.lastSeenAt };

  const vu = widget.lastSeenAt ? Date.parse(widget.lastSeenAt) : NaN;
  if (!Number.isFinite(vu)) {
    // Jamais vu : le dire même si l'interrupteur est en position active.
    return { ...base, statut: 'jamais_vu' };
  }

  if (!widget.enabled) return { ...base, statut: 'coupe' };

  const jours = (now.getTime() - vu) / 86_400_000;
  return { ...base, statut: jours > SILENCE_JOURS ? 'silencieux' : 'en_ligne' };
}

/** « il y a 2 heures » — jamais une date brute, qui obligerait à calculer. */
export function phraseDepuis(iso: string | null, now: Date = new Date()): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;

  const minutes = Math.floor((now.getTime() - t) / 60_000);
  if (minutes < 2) return 'à l’instant';
  if (minutes < 60) return `il y a ${minutes} minutes`;

  const heures = Math.floor(minutes / 60);
  if (heures < 24) return `il y a ${heures} heure${heures > 1 ? 's' : ''}`;

  const jours = Math.floor(heures / 24);
  if (jours < 31) return `il y a ${jours} jour${jours > 1 ? 's' : ''}`;

  const mois = Math.round(jours / 30.44);
  return mois <= 1 ? 'il y a un mois' : `il y a ${mois} mois`;
}
