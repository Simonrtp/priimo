/**
 * Modèle de rapport d'agence : pages de bibliothèque et pages du dossier
 * (couverture, comparables, prix) dans le même ordre.
 */

export const KINDS_GENEREES = ['couverture', 'comparables', 'prix'] as const;
export type KindGeneree = (typeof KINDS_GENEREES)[number];

export const LIBELLE_KIND_GENEREE: Record<KindGeneree, string> = {
  couverture: 'Couverture',
  comparables: 'Comparables',
  prix: 'Prix',
};

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

export const EMAIL_MODELE_DEFAUT = `Bonjour,

Voici le lien pour consulter l'avis de valeur de votre bien.

Je reste à votre disposition pour en parler.

Bien cordialement,`;

export function texteEmailModele(raw: string | null | undefined): string {
  const s = raw?.trim();
  return s && s.length > 0 ? s : EMAIL_MODELE_DEFAUT;
}
