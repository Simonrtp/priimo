type NoteCardInput = {
  transcript: string | null;
  structured?: unknown;
  adresseNormalisee: string | null;
};

export type NoteContactResume = {
  nom: string | null;
  telephone: string | null;
  email: string | null;
  adresse: string | null;
};

export type NoteCardResume = {
  texte: string;
  contact: NoteContactResume | null;
};

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function texte(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function debut(value: string, max = 120): string {
  const propre = value.trim().replace(/\s+/g, ' ');
  if (propre.length <= max) return propre || 'Sans transcription';
  const coupe = propre.slice(0, max + 1);
  const finPhrase = coupe.search(/[.!?](?:\s|$)/);
  if (finPhrase >= 24) return coupe.slice(0, finPhrase + 1);
  const dernierEspace = coupe.lastIndexOf(' ');
  return `${coupe.slice(0, dernierEspace >= 60 ? dernierEspace : max).trim()}…`;
}

/** La première phrase dite, telle quelle, pour la reconnaître parmi d'autres notes. */
export function premierePhraseNote(transcript: string | null | undefined): string | null {
  const propre = (transcript ?? '').trim().replace(/\s+/g, ' ');
  if (!propre) return null;
  const fin = propre.search(/[.!?](?:\s|$)/);
  if (fin >= 12 && fin <= 220) return propre.slice(0, fin + 1);
  const court = debut(propre);
  return court === 'Sans transcription' ? null : court;
}

export function resumeCarteNote(note: NoteCardInput): NoteCardResume {
  const structured = record(note.structured);
  const personnes = Array.isArray(structured?.personnes) ? structured.personnes : [];
  const personne = record(personnes[0]);
  const prenom = texte(personne?.firstName);
  const nomFamille = texte(personne?.lastName);
  const nom = [prenom, nomFamille].filter(Boolean).join(' ') || null;
  const telephone = texte(personne?.phone);
  const email = texte(personne?.email);
  const adresse = texte(structured?.address) ?? note.adresseNormalisee?.trim() ?? null;
  const contact =
    personne && (nom || telephone || email)
      ? { nom, telephone, email, adresse }
      : null;

  const observations = Array.isArray(structured?.observations)
    ? structured.observations.map(texte).filter((value): value is string => Boolean(value))
    : [];
  const contenu =
    texte(structured?.resume) ??
    observations[0] ??
    note.transcript ??
    '';

  return { texte: debut(contenu), contact };
}
