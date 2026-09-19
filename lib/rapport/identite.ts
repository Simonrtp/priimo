/**
 * Identité d’agence et d’agent pour le gabarit du rapport.
 * Aucun libellé orphelin : une ligne vide n’existe pas.
 */

export type IdentiteAgenceRapport = {
  nom: string;
  nomCommercial: string;
  adresse: string | null;
  telephone: string | null;
  email: string | null;
  siteWeb: string | null;
  logoUrl: string | null;
};

export type IdentiteAgentRapport = {
  nom: string | null;
  email: string | null;
  telephone: string | null;
  photoUrl: string | null;
};

export type PiedBienRapport = {
  adresse: string | null;
  ville: string | null;
};

export type PiedRapport = {
  agent: string | null;
  bien: string | null;
  date: string | null;
  page: string;
};

function texte(raw: string | null | undefined): string | null {
  const s = raw?.trim();
  return s ? s : null;
}

/** Jointure sans trou : « a · b » jamais « a ·  · b ». */
export function joindreSansVide(
  parts: Array<string | null | undefined>,
  sep = ' · ',
): string | null {
  const filled = parts.map((p) => texte(p)).filter((p): p is string => Boolean(p));
  return filled.length > 0 ? filled.join(sep) : null;
}

export function ligneAgentPied(agent: IdentiteAgentRapport): string | null {
  return joindreSansVide([agent.nom, agent.email, agent.telephone]);
}

/** Adresse et ville seulement. Jamais « Propriété de , ». */
export function ligneBienPied(bien: PiedBienRapport): string | null {
  return joindreSansVide([bien.adresse, bien.ville], ', ');
}

export function formatDateRapport(iso: string | null | undefined, now = new Date()): string | null {
  const raw = texte(iso);
  const d = raw ? new Date(raw) : now;
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d);
}

export function construirePied(input: {
  agent: IdentiteAgentRapport;
  bien: PiedBienRapport;
  dateIso?: string | null;
  page: number;
  pages: number;
  maintenant?: Date;
}): PiedRapport {
  const page = input.pages > 0 ? `${input.page} / ${input.pages}` : String(input.page);
  return {
    agent: ligneAgentPied(input.agent),
    bien: ligneBienPied(input.bien),
    date: formatDateRapport(input.dateIso ?? null, input.maintenant),
    page,
  };
}

export function nomCommercialAgence(name: string, nomCommercial?: string | null): string {
  return texte(nomCommercial) ?? texte(name) ?? '';
}

export function nomAgentAffiche(first: string | null | undefined, last: string | null | undefined): string | null {
  return joindreSansVide([first, last], ' ');
}
