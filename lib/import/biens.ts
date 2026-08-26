import { parseBienInput, type BienInputFields } from '@/lib/bien-input';
import type { Bien, MandatStatut } from '@/types/bien';
import { MANDAT_STATUT_ORDER } from '@/types/bien';
import type { ImportField } from './mapping';
import { normalizeHeader, normalizeName } from './normalize';

export const BIEN_IMPORT_FIELDS: readonly ImportField[] = [
  { key: 'address', label: 'Adresse', aliases: ['adresse', 'address', 'rue', 'voie'] },
  {
    key: 'postalCode',
    label: 'Code postal',
    aliases: ['codepostal', 'cp', 'postalcode', 'zip'],
  },
  { key: 'city', label: 'Ville', aliases: ['ville', 'city', 'commune', 'localite'] },
  {
    key: 'propertyType',
    label: 'Type',
    aliases: ['type', 'typedebien', 'categorie', 'nature'],
  },
  { key: 'surfaceM2', label: 'Surface', aliases: ['surface', 'm2', 'superficie', 'surfacem2'] },
  { key: 'rooms', label: 'Pièces', aliases: ['pieces', 'nbpieces', 'nbrepieces', 'rooms'] },
  { key: 'price', label: 'Prix', aliases: ['prix', 'price', 'tarif', 'prixdevente'] },
  {
    key: 'mandatStatut',
    label: 'Statut du mandat',
    aliases: ['mandat', 'statut', 'statutdumandat', 'typemandat'],
  },
  { key: 'listingTitle', label: 'Titre', aliases: ['titre', 'titreannonce', 'intitule'] },
  {
    key: 'listingDescription',
    label: 'Description',
    aliases: ['description', 'texte', 'descriptif'],
  },
  { key: 'notes', label: 'Notes', aliases: ['notes', 'commentaire', 'remarque'] },
];

export interface BienDuplicateRef {
  id: string;
  address: string;
  postalCode: string | null;
  city: string | null;
}

function interpretMandat(raw: string): MandatStatut {
  const s = normalizeHeader(raw);
  if (!s) return 'estimation';
  if (s.includes('exclusif')) return 'mandat_exclusif';
  if (s.includes('simple')) return 'mandat_simple';
  if (s.includes('compromis')) return 'compromis';
  if (s.includes('vendu') || s.includes('sold')) return 'vendu';
  if (s.includes('archiv')) return 'archive';
  if (s.includes('estimation') || s.includes('estime')) return 'estimation';
  return (MANDAT_STATUT_ORDER as readonly string[]).includes(raw.trim())
    ? (raw.trim() as MandatStatut)
    : 'estimation';
}

export function bienFieldsFromMapped(mapped: Record<string, string>): BienInputFields | { error: string } {
  const parsed = parseBienInput({
    address: mapped.address ?? '',
    postalCode: mapped.postalCode ?? '',
    city: mapped.city ?? '',
    propertyType: mapped.propertyType ?? '',
    surfaceM2: mapped.surfaceM2 ?? '',
    rooms: mapped.rooms ?? '',
    price: mapped.price ?? '',
    mandatStatut: interpretMandat(mapped.mandatStatut ?? ''),
    listingTitle: mapped.listingTitle ?? '',
    listingDescription: mapped.listingDescription ?? '',
    notes: mapped.notes ?? '',
  });
  return parsed.ok ? parsed.fields : { error: parsed.error };
}

function addressKey(address: string, postalCode: string | null, city: string | null): string {
  const loc = postalCode?.trim() || normalizeName(city ?? '');
  return `${normalizeName(address)}|${loc}`;
}

export function findBienDuplicate(
  fields: BienInputFields,
  existing: readonly BienDuplicateRef[],
): BienDuplicateRef | null {
  const key = addressKey(fields.address, fields.postalCode, fields.city);
  if (!normalizeName(fields.address)) return null;
  return (
    existing.find((b) => addressKey(b.address, b.postalCode, b.city) === key) ?? null
  );
}

export function bienToDuplicateRef(bien: Bien): BienDuplicateRef {
  return {
    id: bien.id,
    address: bien.address,
    postalCode: bien.postalCode,
    city: bien.city,
  };
}

export function bienToInput(bien: Bien): BienInputFields {
  return {
    address: bien.address,
    city: bien.city,
    postalCode: bien.postalCode,
    propertyType: bien.propertyType,
    surfaceM2: bien.surfaceM2,
    rooms: bien.rooms,
    price: bien.price,
    mandatStatut: bien.mandatStatut,
    proprietaireContactId: bien.proprietaireContactId,
    notes: bien.notes,
    listingTitle: bien.listingTitle,
    listingDescription: bien.listingDescription,
    photos: bien.photos,
    dpeLettre: bien.dpeLettre,
    dpeKwh: bien.dpeKwh,
    gesLettre: bien.gesLettre,
    gesKgCo2: bien.gesKgCo2,
    dpeVierge: bien.dpeVierge,
    dpeDate: bien.dpeDate,
    honorairesMontant: bien.honorairesMontant,
    honorairesACharge: bien.honorairesACharge,
    honorairesPourcent: bien.honorairesPourcent,
    mandatNumero: bien.mandatNumero,
    mandatDate: bien.mandatDate,
    estCopropriete: bien.estCopropriete,
    nombreLots: bien.nombreLots,
    chargesAnnuelles: bien.chargesAnnuelles,
    procedureEnCours: bien.procedureEnCours,
  };
}

export function mergeBienFields(
  existing: BienInputFields,
  incoming: BienInputFields,
  keys: ReadonlySet<string>,
): BienInputFields {
  const next = { ...existing };
  (Object.keys(incoming) as (keyof BienInputFields)[]).forEach((key) => {
    if (keys.has(key)) {
      (next[key] as BienInputFields[typeof key]) = incoming[key];
    }
  });
  return next;
}

export type DuplicateStrategy = 'ignore' | 'update';

export type PlannedRow<T, D> =
  | { action: 'create'; line: number; fields: T }
  | { action: 'update'; line: number; fields: T; duplicate: D }
  | { action: 'skip'; line: number; reason: string };

export function planBienImport(
  rows: readonly { line: number; mapped: Record<string, string> }[],
  existing: readonly BienDuplicateRef[],
  strategy: DuplicateStrategy,
): PlannedRow<BienInputFields, BienDuplicateRef>[] {
  const known: BienDuplicateRef[] = existing.map((b) => ({ ...b }));
  const pending = new Map<string, number>();
  const plan: PlannedRow<BienInputFields, BienDuplicateRef>[] = [];

  for (const row of rows) {
    const parsed = bienFieldsFromMapped(row.mapped);
    if ('error' in parsed) {
      plan.push({ action: 'skip', line: row.line, reason: parsed.error });
      continue;
    }

    const duplicate = findBienDuplicate(parsed, known);
    if (duplicate) {
      if (strategy === 'ignore') {
        plan.push({
          action: 'skip',
          line: row.line,
          reason: duplicate.id.startsWith('pending:')
            ? 'Doublon dans le fichier'
            : `Adresse déjà connue (${duplicate.address})`,
        });
        continue;
      }
      const pendingIndex = pending.get(duplicate.id);
      if (pendingIndex !== undefined) {
        const current = plan[pendingIndex];
        if (current && current.action === 'create') {
          plan[pendingIndex] = { action: 'create', line: current.line, fields: parsed };
        }
        const k = known.findIndex((x) => x.id === duplicate.id);
        if (k !== -1) {
          known[k] = {
            ...duplicate,
            address: parsed.address,
            postalCode: parsed.postalCode,
            city: parsed.city,
          };
        }
        plan.push({
          action: 'skip',
          line: row.line,
          reason: `Doublon dans le fichier (ligne ${current && 'line' in current ? current.line : '?'})`,
        });
        continue;
      }
      plan.push({ action: 'update', line: row.line, fields: parsed, duplicate });
      const idx = known.findIndex((x) => x.id === duplicate.id);
      if (idx !== -1) {
        known[idx] = {
          ...duplicate,
          address: parsed.address,
          postalCode: parsed.postalCode,
          city: parsed.city,
        };
      }
      continue;
    }

    const tempId = `pending:${row.line}`;
    pending.set(tempId, plan.length);
    known.push({
      id: tempId,
      address: parsed.address,
      postalCode: parsed.postalCode,
      city: parsed.city,
    });
    plan.push({ action: 'create', line: row.line, fields: parsed });
  }

  return plan;
}
