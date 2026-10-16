/**
 * Le brief du matin.
 *
 * Une notification par jour, et une seule. Elle doit tenir sur l'écran
 * verrouillé d'un téléphone et donner une raison d'ouvrir l'application — pas
 * résumer la base de données. Tout ce qui n'entre pas dans deux phrases n'a
 * rien à faire ici.
 *
 * Règle de silence : quand il n'y a rien à dire, on ne dit rien. Une
 * notification quotidienne qui annonce « 0 rendez-vous, 0 action » apprend à
 * l'agent à couper les notifications, et on ne les récupère jamais.
 *
 * Module pur : aucune dépendance, entièrement testable.
 */

export interface MatiereBrief {
  prenom: string | null;
  /** Propositions ouvertes qui attendent l'agent. */
  actionsOuvertes: number;
  /** Titre de la meilleure proposition, pour donner un contenu concret. */
  meilleureAction: string | null;
  rendezVous: number;
  /** Promesses dont l'échéance tombe aujourd'hui ou avant. */
  promessesDues: number;
  /** Ligne déjà rédigée, ou null s'il n'y a ni baisse ni retrait. */
  annoncesPhrase?: string | null;
}

export interface Brief {
  titre: string;
  corps: string;
  /** Où mène le clic sur la notification. */
  url: string;
}

function pluriel(n: number, singulier: string, pluriel: string): string {
  return `${n} ${n > 1 ? pluriel : singulier}`;
}

/**
 * Rend null quand la journée ne mérite pas d'être annoncée : c'est le
 * comportement le plus important de ce module.
 */
export function construireBrief(matiere: MatiereBrief): Brief | null {
  const { actionsOuvertes, rendezVous, promessesDues } = matiere;
  const annoncesPhrase = matiere.annoncesPhrase?.trim() || null;
  if (actionsOuvertes === 0 && rendezVous === 0 && promessesDues === 0 && !annoncesPhrase) return null;

  const salut = matiere.prenom?.trim() ? `Bonjour ${matiere.prenom.trim()}` : 'Bonjour';

  const morceaux: string[] = [];
  if (rendezVous > 0) morceaux.push(pluriel(rendezVous, 'rendez-vous', 'rendez-vous'));
  if (promessesDues > 0) morceaux.push(pluriel(promessesDues, 'promesse', 'promesses'));
  if (actionsOuvertes > 0) morceaux.push(pluriel(actionsOuvertes, 'action à valider', 'actions à valider'));

  const titre =
    morceaux.length === 1
      ? `${salut} — ${morceaux[0]}`
      : `${salut} — ${morceaux.slice(0, -1).join(', ')} et ${morceaux[morceaux.length - 1]}`;

  // Le corps sert à donner envie d'ouvrir : une proposition nommée vaut mieux
  // qu'un décompte de plus.
  const base = matiere.meilleureAction
    ? matiere.meilleureAction
    : rendezVous > 0
      ? 'Votre tournée du jour vous attend.'
      : actionsOuvertes > 0 || promessesDues > 0
        ? 'Votre journée est prête.'
        : '';
  const corps = [base, annoncesPhrase].filter(Boolean).join(' ');

  return {
    titre: morceaux.length === 0 && annoncesPhrase ? `${salut} — ${annoncesPhrase}` : titre,
    corps: corps || annoncesPhrase || 'Votre journée est prête.',
    url:
      morceaux.length === 0 && annoncesPhrase
        ? '/dashboard/annonces?mouvements=1'
        : actionsOuvertes > 0
          ? '/dashboard/actions'
          : '/dashboard',
  };
}
