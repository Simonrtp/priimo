/**
 * Modèle de rapport d'agence : pages de bibliothèque et pages générées
 * depuis les données du dossier, dans le même ordre.
 */

export const KINDS_GENEREES = [
  'couverture',
  'votre_bien',
  'description',
  'immeuble_appartement',
  'secteur',
  'points_interet',
  'connectivite',
  'permis',
  'comparables',
  'concurrentiel',
  'indices',
  'prix',
  'prochaine_etape',
] as const;
export type KindGeneree = (typeof KINDS_GENEREES)[number];

/** Pages générées avant le bloc bibliothèque. */
export const KINDS_AVANT_BIBLIO = [
  'couverture',
  'votre_bien',
  'description',
  'immeuble_appartement',
  'secteur',
  'points_interet',
  'connectivite',
  'permis',
  'comparables',
  'concurrentiel',
  'indices',
  'prix',
] as const satisfies readonly KindGeneree[];

/** Dernière page du rapport, après la bibliothèque. */
export const KINDS_APRES_BIBLIO = ['prochaine_etape'] as const satisfies readonly KindGeneree[];

export const LIBELLE_KIND_GENEREE: Record<KindGeneree, string> = {
  couverture: 'Couverture',
  votre_bien: 'Votre bien',
  description: 'Description du bien',
  immeuble_appartement: 'L’immeuble et l’appartement',
  secteur: 'Le secteur',
  points_interet: 'Points d’intérêt',
  connectivite: 'Connectivité',
  permis: 'Permis de construire',
  comparables: 'Ventes comparables',
  concurrentiel: 'Étude concurrentielle',
  indices: 'Indices du marché',
  prix: 'Notre estimation',
  prochaine_etape: 'Prochaine étape',
};

export const TITRE_COUVERTURE_DEFAUT = 'Avis de valeur';

export const CTA_PROCHAINE_ETAPE_DEFAUT =
  'Pour lancer la commercialisation de votre bien, la prochaine étape est la signature du mandat.';

export type SlotModele =
  | { source: 'bibliotheque'; bibliothequeId: string }
  | { source: 'generee'; kindGeneree: KindGeneree };

export function estKindGeneree(value: unknown): value is KindGeneree {
  return typeof value === 'string' && (KINDS_GENEREES as readonly string[]).includes(value);
}

export function parseSlotModele(raw: unknown): SlotModele | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (o.source === 'bibliotheque' && typeof o.bibliothequeId === 'string' && o.bibliothequeId) {
    return { source: 'bibliotheque', bibliothequeId: o.bibliothequeId };
  }
  if (o.source === 'generee' && estKindGeneree(o.kindGeneree)) {
    return { source: 'generee', kindGeneree: o.kindGeneree };
  }
  return null;
}

export function parseSlotsModele(raw: unknown): SlotModele[] | null {
  if (!Array.isArray(raw)) return null;
  const slots: SlotModele[] = [];
  for (const item of raw) {
    const slot = parseSlotModele(item);
    if (!slot) return null;
    slots.push(slot);
  }
  return slots;
}

export function slotsDepuisLignes(
  rows: ReadonlyArray<{
    source: string;
    bibliotheque_id: string | null;
    kind_generee: string | null;
  }>,
): SlotModele[] {
  const slots: SlotModele[] = [];
  for (const row of rows) {
    if (row.source === 'bibliotheque' && row.bibliotheque_id) {
      slots.push({ source: 'bibliotheque', bibliothequeId: row.bibliotheque_id });
    } else if (row.source === 'generee' && estKindGeneree(row.kind_generee)) {
      slots.push({ source: 'generee', kindGeneree: row.kind_generee });
    }
  }
  return slots;
}

export function nomSlotModele(
  slot: SlotModele,
  biblioParId: ReadonlyMap<string, { nom: string }>,
): string {
  if (slot.source === 'generee') return LIBELLE_KIND_GENEREE[slot.kindGeneree];
  return biblioParId.get(slot.bibliothequeId)?.nom ?? 'Page retirée';
}

/** Insère les 13 pages générées autour des pages de bibliothèque déjà présentes. */
export function insererPagesGenerees(slots: readonly SlotModele[]): SlotModele[] {
  const biblio = slots.filter((s): s is Extract<SlotModele, { source: 'bibliotheque' }> => s.source === 'bibliotheque');
  return [
    ...KINDS_AVANT_BIBLIO.map((kindGeneree) => ({ source: 'generee' as const, kindGeneree })),
    ...biblio,
    ...KINDS_APRES_BIBLIO.map((kindGeneree) => ({ source: 'generee' as const, kindGeneree })),
  ];
}

export function titreCouvertureAgence(raw: string | null | undefined): string {
  const s = raw?.trim();
  return s && s.length > 0 ? s : TITRE_COUVERTURE_DEFAUT;
}

export function ctaProchaineEtape(raw: string | null | undefined): string {
  const s = raw?.trim();
  return s && s.length > 0 ? s : CTA_PROCHAINE_ETAPE_DEFAUT;
}

export const EMAIL_MODELE_DEFAUT = `Bonjour,

Voici le lien pour consulter l'avis de valeur de votre bien.

Je reste à votre disposition pour en parler.

Bien cordialement,`;

export function texteEmailModele(raw: string | null | undefined): string {
  const s = raw?.trim();
  return s && s.length > 0 ? s : EMAIL_MODELE_DEFAUT;
}
