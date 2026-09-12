export const CRITERE_NOTES = [1, 2, 3, 4, 5] as const;
export type CritereNote = (typeof CRITERE_NOTES)[number];

export const CRITERE_NOTE_LABELS: Record<CritereNote, string> = {
  1: 'Mauvais',
  2: 'Médiocre',
  3: 'Moyen',
  4: 'Bon',
  5: 'Très bon',
};

export type CritereSource = 'agent' | 'donnees';

export type CritereValeur = {
  valeur: CritereNote | null;
  source: CritereSource;
};

export type FamilleGrilleId =
  | 'elements_principaux'
  | 'autres_elements'
  | 'environnement'
  | 'criteres_generaux'
  | 'sejour'
  | 'cuisine'
  | 'chambres'
  | 'sanitaires'
  | 'energie';

export type CritereDef = {
  id: string;
  famille: FamilleGrilleId;
  libelle: string;
};

export const FAMILLES_GRILLE: { id: FamilleGrilleId; libelle: string }[] = [
  { id: 'elements_principaux', libelle: 'Éléments principaux' },
  { id: 'autres_elements', libelle: 'Autres éléments' },
  { id: 'environnement', libelle: 'Environnement' },
  { id: 'criteres_generaux', libelle: 'Critères généraux' },
  { id: 'sejour', libelle: 'Le séjour' },
  { id: 'cuisine', libelle: 'La cuisine' },
  { id: 'chambres', libelle: 'Les chambres' },
  { id: 'sanitaires', libelle: 'Les sanitaires' },
  { id: 'energie', libelle: 'Énergie' },
];

export const CRITERES_GRILLE: readonly CritereDef[] = [
  { id: 'standing', famille: 'elements_principaux', libelle: 'Standing' },
  { id: 'etat_general', famille: 'elements_principaux', libelle: 'État général' },
  { id: 'luminosite', famille: 'elements_principaux', libelle: 'Luminosité' },
  { id: 'vue', famille: 'elements_principaux', libelle: 'Vue' },
  { id: 'calme', famille: 'elements_principaux', libelle: 'Calme' },
  { id: 'copropriete', famille: 'autres_elements', libelle: 'Copropriété' },
  { id: 'parties_communes', famille: 'autres_elements', libelle: 'Parties communes' },
  { id: 'cave_cellier', famille: 'autres_elements', libelle: 'Cave ou cellier' },
  { id: 'exterieur', famille: 'autres_elements', libelle: 'Extérieur' },
  { id: 'quartier', famille: 'environnement', libelle: 'Quartier' },
  { id: 'commerces', famille: 'environnement', libelle: 'Commerces' },
  { id: 'transports', famille: 'environnement', libelle: 'Transports' },
  { id: 'nuisances', famille: 'environnement', libelle: 'Nuisances' },
  { id: 'exposition', famille: 'criteres_generaux', libelle: 'Exposition' },
  { id: 'agencement', famille: 'criteres_generaux', libelle: 'Agencement' },
  { id: 'rangements', famille: 'criteres_generaux', libelle: 'Rangements' },
  { id: 'securite', famille: 'criteres_generaux', libelle: 'Sécurité' },
  { id: 'surface_sejour', famille: 'sejour', libelle: 'Surface' },
  { id: 'luminosite_sejour', famille: 'sejour', libelle: 'Luminosité' },
  { id: 'etat_sejour', famille: 'sejour', libelle: 'État' },
  { id: 'volume_sejour', famille: 'sejour', libelle: 'Volume' },
  { id: 'etat_cuisine', famille: 'cuisine', libelle: 'État' },
  { id: 'equipement_cuisine', famille: 'cuisine', libelle: 'Équipement' },
  { id: 'surface_cuisine', famille: 'cuisine', libelle: 'Surface' },
  { id: 'surface_chambres', famille: 'chambres', libelle: 'Surface' },
  { id: 'luminosite_chambres', famille: 'chambres', libelle: 'Luminosité' },
  { id: 'calme_chambres', famille: 'chambres', libelle: 'Calme' },
  { id: 'nombre_sdb', famille: 'sanitaires', libelle: 'Nombre' },
  { id: 'etat_sdb', famille: 'sanitaires', libelle: 'État' },
  { id: 'modernite_sdb', famille: 'sanitaires', libelle: 'Modernité' },
  { id: 'isolation', famille: 'energie', libelle: 'Isolation' },
  { id: 'chauffage', famille: 'energie', libelle: 'Chauffage' },
  { id: 'menuiseries', famille: 'energie', libelle: 'Menuiseries' },
  { id: 'dpe_ressenti', famille: 'energie', libelle: 'DPE' },
];

export const CRITERES_TOTAL = CRITERES_GRILLE.length;

export type GrilleSaisie = Record<string, CritereValeur>;

export function grilleVide(): GrilleSaisie {
  return {};
}

export function estNote(raw: unknown): raw is CritereNote {
  return raw === 1 || raw === 2 || raw === 3 || raw === 4 || raw === 5;
}

export function lireCritere(grille: GrilleSaisie, id: string): CritereValeur {
  const row = grille[id];
  if (!row) return { valeur: null, source: 'agent' };
  return {
    valeur: estNote(row.valeur) ? row.valeur : null,
    source: row.source === 'donnees' ? 'donnees' : 'agent',
  };
}

export function criteresRenseignes(grille: GrilleSaisie): number {
  return CRITERES_GRILLE.filter((c) => lireCritere(grille, c.id).valeur != null).length;
}

/** En dessous, le document remis doit le dire — pas seulement l’écran agent. */
export const SEUIL_CRITERES_FIABLES = 8;

export const MENTION_PEU_FIABLE = 'Estimation peu fiable';

export function estimationPeuFiable(grille: GrilleSaisie): boolean {
  return criteresRenseignes(grille) < SEUIL_CRITERES_FIABLES;
}

/** Moyenne 1–5 d'une famille. Null si aucun critère touché — un trou, pas un 3. */
export function scoreFamille(grille: GrilleSaisie, famille: FamilleGrilleId): number | null {
  const notes = CRITERES_GRILLE.filter((c) => c.famille === famille)
    .map((c) => lireCritere(grille, c.id).valeur)
    .filter((n): n is CritereNote => n != null);
  if (notes.length === 0) return null;
  return notes.reduce((s, n) => s + n, 0) / notes.length;
}

export type AxeRadar = {
  famille: FamilleGrilleId;
  libelle: string;
  /** Null = trou : la ligne ne passe pas par cet axe. */
  score: number | null;
};

export function axesRadar(grille: GrilleSaisie): AxeRadar[] {
  return FAMILLES_GRILLE.map((f) => ({
    famille: f.id,
    libelle: f.libelle,
    score: scoreFamille(grille, f.id),
  }));
}

/**
 * Indice de qualité, plafonné à ±10 %.
 * 3 = marché (0 %). 5 = +10 %. 1 = −10 %. Aucun critère → 0, pas de ligne.
 */
export function indiceQualitePct(grille: GrilleSaisie): number | null {
  const notes = CRITERES_GRILLE.map((c) => lireCritere(grille, c.id).valeur).filter(
    (n): n is CritereNote => n != null,
  );
  if (notes.length === 0) return null;
  const moyenne = notes.reduce((s, n) => s + n, 0) / notes.length;
  const brut = ((moyenne - 3) / 2) * 0.1;
  return Math.max(-0.1, Math.min(0.1, brut));
}

const DPE_VERS_NOTE: Record<string, CritereNote> = {
  A: 5,
  B: 4,
  C: 4,
  D: 3,
  E: 2,
  F: 1,
  G: 1,
};

function poserDonnee(grille: GrilleSaisie, id: string, note: CritereNote | null): void {
  if (note == null) return;
  const actuel = lireCritere(grille, id);
  if (actuel.valeur != null && actuel.source === 'agent') return;
  grille[id] = { valeur: note, source: 'donnees' };
}

/** Préremplit l'énergie depuis une étiquette ADEME, sans écraser une saisie agent. */
export function preremplirDepuisDpe(grille: GrilleSaisie, dpeClass: string | null): GrilleSaisie {
  const lettre = (dpeClass ?? '').trim().toUpperCase();
  const note = DPE_VERS_NOTE[lettre];
  if (!note) return grille;
  const next = { ...grille };
  poserDonnee(next, 'dpe_ressenti', note);
  poserDonnee(next, 'isolation', note);
  return next;
}

/**
 * 1 si rien, puis chaque palier relève d’un cran.
 * Ex. [1, 4, 10, 20] → 0=1, 1–3=2, 4–9=3, 10–19=4, 20+=5.
 */
export function noteDepuisComptage(
  n: number,
  paliers: readonly [number, number, number, number],
): CritereNote {
  if (n >= paliers[3]) return 5;
  if (n >= paliers[2]) return 4;
  if (n >= paliers[1]) return 3;
  if (n >= paliers[0]) return 2;
  return 1;
}

export type SignauxPublicsGrille = {
  dpeClass?: string | null;
  commerces?: number | null;
  transports?: number | null;
};

/** Préremplit l’environnement et l’énergie depuis le public, sans écraser l’agent. */
/** Garde les notes agent déjà posées, complète avec le public. */
export function fusionnerGrille(actuel: GrilleSaisie, propose: GrilleSaisie): GrilleSaisie {
  const next = { ...actuel };
  for (const [id, val] of Object.entries(propose)) {
    const cur = lireCritere(next, id);
    if (cur.valeur != null && cur.source === 'agent') continue;
    next[id] = val;
  }
  return next;
}

export function preremplirDepuisPublic(grille: GrilleSaisie, signaux: SignauxPublicsGrille): GrilleSaisie {
  const next = preremplirDepuisDpe(grille, signaux.dpeClass ?? null);
  const commerces =
    signaux.commerces != null ? noteDepuisComptage(signaux.commerces, [1, 4, 10, 20]) : null;
  const transports =
    signaux.transports != null ? noteDepuisComptage(signaux.transports, [1, 2, 5, 10]) : null;
  poserDonnee(next, 'commerces', commerces);
  poserDonnee(next, 'transports', transports);
  if (commerces != null || transports != null) {
    const notes = [commerces, transports].filter((n): n is CritereNote => n != null);
    const quartier = Math.round(notes.reduce((s, n) => s + n, 0) / notes.length) as CritereNote;
    poserDonnee(next, 'quartier', quartier);
  }
  return next;
}
