/**
 * Temps de saisie qu'une dictée évite, en minutes. Estimation prudente,
 * affichée avec « ≈ » :
 *   — taper le texte au téléphone : ~150 caractères par minute ;
 *   — chaque fiche créée ou tenue à jour : le temps de l'ouvrir et de la remplir.
 */

const CARACTERES_PAR_MINUTE = 150;
const MINUTES_PAR_CONTACT = 1.5;
const MINUTES_PAR_ACTION = 0.75;
const MINUTES_PAR_MISE_A_JOUR = 0.5;

export type BilanNote = {
  caracteres: number;
  contacts?: number;
  actions?: number;
  misesAJour?: number;
};

export function minutesEvitees(b: BilanNote): number {
  const minutes =
    b.caracteres / CARACTERES_PAR_MINUTE +
    (b.contacts ?? 0) * MINUTES_PAR_CONTACT +
    (b.actions ?? 0) * MINUTES_PAR_ACTION +
    (b.misesAJour ?? 0) * MINUTES_PAR_MISE_A_JOUR;
  return Math.max(0, Math.round(minutes * 2) / 2);
}

/** Une note déjà rangée : on relit ce que son analyse avait proposé. */
export function minutesEviteesNote(note: { transcript: string | null; structured?: unknown }): number {
  const s = note.structured && typeof note.structured === 'object' ? (note.structured as Record<string, unknown>) : {};
  const longueur = (v: unknown) => (Array.isArray(v) ? v.length : 0);
  return minutesEvitees({
    caracteres: (note.transcript ?? '').length,
    contacts: longueur(s.personnes),
    actions: longueur(s.actions),
    misesAJour: longueur(s.mises_a_jour ?? s.misesAJour),
  });
}

export function formatMinutes(minutes: number): string {
  if (minutes < 1) return 'moins d’une minute';
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes - h * 60);
  return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`;
}

/** Chaque note rangée évite aussi d'ouvrir la bonne fiche et de la retrouver. */
const MINUTES_PAR_NOTE = 0.75;

/** Le mois en cours, à l'heure de Paris : notes dictées et temps évité. */
export function bilanDuMois(
  notes: readonly { transcript: string | null; createdAt: string }[],
  maintenant = new Date(),
): { notes: number; minutes: number; libelle: string } {
  const mois = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit' }).format(
    maintenant,
  );
  const duMois = notes.filter(
    (n) =>
      new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit' }).format(
        new Date(n.createdAt),
      ) === mois,
  );
  const minutes = duMois.reduce(
    (total, n) => total + minutesEvitees({ caracteres: (n.transcript ?? '').length }) + MINUTES_PAR_NOTE,
    0,
  );
  return { notes: duMois.length, minutes, libelle: formatMinutes(minutes) };
}
