import { dansLaSemaine, type Intervalle } from '@/lib/activite/semaines';
import { formatNoteWhen } from '@/lib/notes/format-when';
import { dateKeyParis } from '@/lib/today/calendar';

const LIEUX = new Set(['immeuble', 'bien', 'parcelle']);

export type NotePourLigne = {
  createdBy: string | null;
  createdAt: string;
  author: { firstName: string } | null;
  authorName: string | null;
  adresseNormalisee: string | null;
  rattachements: readonly { type: string; label: string }[];
};

/** L'adresse seulement si la note est posée sur un lieu. Un contact seul ne suffit pas. */
export function adresseRattachee(note: Pick<NotePourLigne, 'rattachements' | 'adresseNormalisee'>): string | null {
  const lieu = note.rattachements.find((r) => LIEUX.has(r.type));
  const label = lieu?.label.trim();
  if (label) return label;
  const adresse = note.adresseNormalisee?.trim();
  return adresse || null;
}

export function prenomAuteur(note: Pick<NotePourLigne, 'author' | 'authorName'>): string | null {
  const prenom = note.author?.firstName.trim();
  if (prenom) return prenom;
  const nom = note.authorName?.trim();
  if (!nom) return null;
  return nom.split(/\s+/)[0] || null;
}

/** Une ligne : prénom, adresse s'il y en a une, moment. */
export function ligneDerniereNote(note: NotePourLigne, now = Date.now()): string {
  return [prenomAuteur(note), adresseRattachee(note), formatNoteWhen(note.createdAt, now)]
    .filter((partie): partie is string => Boolean(partie))
    .join(' · ');
}

/** La note la plus récente de la personne, dans la période affichée. */
export function derniereNoteDeLaPeriode<T extends NotePourLigne>(
  notes: readonly T[],
  input: { membreId: string | null; intervalle: Intervalle },
): T | null {
  let meilleure: T | null = null;
  let meilleurTemps = -Infinity;
  for (const note of notes) {
    if (input.membreId && note.createdBy !== input.membreId) continue;
    const temps = Date.parse(note.createdAt);
    if (!Number.isFinite(temps)) continue;
    if (!dansLaSemaine(dateKeyParis(new Date(temps)), input.intervalle)) continue;
    if (temps <= meilleurTemps) continue;
    meilleure = note;
    meilleurTemps = temps;
  }
  return meilleure;
}
