/**
 * Modèle de rapport d'agence : pages de bibliothèque et pages générées
 * depuis les données du dossier, dans le même ordre.
 */

import { nomPersonne } from '@/lib/rapport/genere/format';

/** Gabarit avis v2 : une page, un sujet. Les kinds absorbés restent lisibles pour les anciens rapports. */
export const KINDS_GABARIT_V2 = [
  'couverture',
  'votre_bien',
  'immeuble_appartement',
  'secteur',
  'comparables',
  'concurrentiel',
  'prix',
] as const;

/** Anciennes pages fusionnées dans le gabarit 7 — ne plus les insérer ni les afficher. */
export const KINDS_ABSORBEES = [
  'description',
  'points_interet',
  'connectivite',
  'permis',
  'indices',
  'prochaine_etape',
] as const;

export const KINDS_GENEREES = [...KINDS_GABARIT_V2, ...KINDS_ABSORBEES] as const;
export type KindGeneree = (typeof KINDS_GENEREES)[number];
export type KindGabaritV2 = (typeof KINDS_GABARIT_V2)[number];

/** Pages générées avant le bloc bibliothèque. */
export const KINDS_AVANT_BIBLIO = KINDS_GABARIT_V2;

/** Plus de page dédiée après la bibliothèque : le CTA est sur Notre estimation. */
export const KINDS_APRES_BIBLIO = [] as const satisfies readonly KindGeneree[];

export const LIBELLE_KIND_GENEREE: Record<KindGeneree, string> = {
  couverture: 'Couverture',
  votre_bien: 'Votre bien',
  description: 'Description du bien',
  immeuble_appartement: 'L’immeuble et son environnement',
  secteur: 'Les prix dans votre quartier',
  points_interet: 'Points d’intérêt',
  connectivite: 'Connectivité',
  permis: 'Permis de construire',
  comparables: 'Les ventes comparables',
  concurrentiel: 'Les biens en vente autour de vous',
  indices: 'Indices du marché',
  prix: 'Notre estimation',
  prochaine_etape: 'Prochaine étape',
};

export function estKindAbsorbee(kind: KindGeneree): boolean {
  return (KINDS_ABSORBEES as readonly string[]).includes(kind);
}

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

/** Page bibliothèque de test (captures internes) — jamais livrée au client. */
export function estPageTestBibliotheque(nom: string | null | undefined): boolean {
  const n = (nom ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('fr');
  if (!n.trim()) return false;
  return (
    /\bhello\b/.test(n) ||
    /dans ton secteur/.test(n) ||
    /\balan\b/.test(n) ||
    /page de test/.test(n) ||
    /^test\b/.test(n)
  );
}

/** Insère les 7 pages du gabarit autour des pages de bibliothèque déjà présentes. */
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

/** Message proposé à l’agent pour ce dossier : prénom du client et signature de l’agent. */
export function composerMessageClient(input: {
  prenomClient?: string | null;
  nomAgent?: string | null;
  modele?: string | null;
}): string {
  const custom = input.modele?.trim();
  if (custom && custom !== EMAIL_MODELE_DEFAUT) return custom;
  const prenom = nomPersonne(input.prenomClient);
  const agent = nomPersonne(input.nomAgent);
  const salut = prenom ? `Bonjour ${prenom},` : 'Bonjour,';
  const signature = agent ? `\n\n${agent}` : '';
  return `${salut}

Voici le lien pour consulter l'avis de valeur de votre bien.

Je reste à votre disposition pour en parler.

Bien cordialement,${signature}`;
}
