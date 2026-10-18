export const POSTES_PRESTATION = [
  { id: 'cuisine', libelle: 'Cuisine' },
  { id: 'salle_de_bain', libelle: 'Salle de bain' },
  { id: 'sol', libelle: 'Sol' },
  { id: 'fenetres', libelle: 'Fenêtres' },
  { id: 'maconnerie', libelle: 'Maçonnerie' },
] as const;

export type PostePrestationId = (typeof POSTES_PRESTATION)[number]['id'];

export const QUALITES_PRESTATION = ['Basique', 'Standard', 'Soignée', 'Haut de gamme'] as const;
export const ETATS_PRESTATION = ['À rénover', 'Moyen', 'Bon', 'Très bon'] as const;

export type QualitePrestation = (typeof QUALITES_PRESTATION)[number];
export type EtatPrestation = (typeof ETATS_PRESTATION)[number];

export type PrestationSaisie = {
  qualite: QualitePrestation | null;
  etat: EtatPrestation | null;
};

export type PrestationsSaisie = Record<PostePrestationId, PrestationSaisie>;

export function prestationsVides(): PrestationsSaisie {
  return {
    cuisine: { qualite: null, etat: null },
    salle_de_bain: { qualite: null, etat: null },
    sol: { qualite: null, etat: null },
    fenetres: { qualite: null, etat: null },
    maconnerie: { qualite: null, etat: null },
  };
}

function estQualite(v: unknown): v is QualitePrestation {
  return typeof v === 'string' && (QUALITES_PRESTATION as readonly string[]).includes(v);
}

function estEtat(v: unknown): v is EtatPrestation {
  return typeof v === 'string' && (ETATS_PRESTATION as readonly string[]).includes(v);
}

export function parsePrestations(raw: unknown): PrestationsSaisie {
  const out = prestationsVides();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  const o = raw as Record<string, unknown>;
  for (const poste of POSTES_PRESTATION) {
    const row = o[poste.id];
    if (!row || typeof row !== 'object' || Array.isArray(row)) continue;
    const r = row as Record<string, unknown>;
    out[poste.id] = {
      qualite: estQualite(r.qualite) ? r.qualite : null,
      etat: estEtat(r.etat) ? r.etat : null,
    };
  }
  return out;
}

export function prestationsRenseignees(
  saisie: PrestationsSaisie,
): Array<{ id: PostePrestationId; libelle: string; qualite: QualitePrestation | null; etat: EtatPrestation | null }> {
  return POSTES_PRESTATION.map((p) => ({
    id: p.id,
    libelle: p.libelle,
    qualite: saisie[p.id].qualite,
    etat: saisie[p.id].etat,
  })).filter((p) => p.qualite != null || p.etat != null);
}
