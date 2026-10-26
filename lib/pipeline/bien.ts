import type { BienDuPipeline, Lead } from '@/types/lead';

/**
 * Ce qui entre au pipeline est un bien. Le lead porte l'étape et la position ;
 * le bien (biens.lead_id) porte ce que l'agent reconnaît : type, surface, prix.
 * Pur.
 */

/** Le lead parle en minuscules (« appartement »), la fiche bien en libellé (« Appartement »). */
export function typeBienFiche(type: string | null | undefined): string | null {
  if (!type) return null;
  const t = type.trim().toLowerCase();
  if (t === 'appartement') return 'Appartement';
  if (t === 'maison') return 'Maison';
  return null;
}

export type LigneBienPipeline = {
  id: string;
  lead_id: string | null;
  property_type: string | null;
  surface_m2: number | null;
  rooms: number | null;
  price: number | null;
  photos: string[] | null;
};

export function bienDepuisLigne(row: LigneBienPipeline): BienDuPipeline {
  const photos = Array.isArray(row.photos) ? row.photos.filter((p) => typeof p === 'string' && p) : [];
  return {
    id: row.id,
    propertyType: row.property_type,
    surfaceM2: row.surface_m2,
    rooms: row.rooms,
    price: row.price,
    photo: photos[0] ?? null,
  };
}

/** Un bien par lead : le plus récent l'emporte si l'agent en a rattaché deux. */
export function biensParLead(rows: readonly LigneBienPipeline[]): Map<string, BienDuPipeline> {
  const map = new Map<string, BienDuPipeline>();
  for (const row of rows) {
    if (!row.lead_id || map.has(row.lead_id)) continue;
    map.set(row.lead_id, bienDepuisLigne(row));
  }
  return map;
}

export function avecBiens<T extends Lead>(leads: readonly T[], biens: Map<string, BienDuPipeline>): T[] {
  if (biens.size === 0) return [...leads];
  return leads.map((lead) => {
    const bien = biens.get(lead.id);
    return bien ? { ...lead, bien } : lead;
  });
}

/** « Appartement · 62 m² · 3 p. » : la fiche bien d'abord, le lead à défaut. */
export function resumeBien(lead: Pick<Lead, 'propertyType' | 'surfaceM2' | 'rooms' | 'bien'>): string | null {
  const b = lead.bien ?? null;
  const type = b?.propertyType ?? typeBienFiche(lead.propertyType);
  const surface = b?.surfaceM2 ?? lead.surfaceM2;
  const pieces = b?.rooms ?? lead.rooms;
  const morceaux = [
    type,
    surface != null && surface > 0 ? `${Math.round(surface)} m²` : null,
    pieces != null && pieces > 0 ? `${pieces} p.` : null,
  ].filter(Boolean);
  return morceaux.length > 0 ? morceaux.join(' · ') : null;
}

export function prixBien(prix: number | null | undefined): string | null {
  if (prix == null || !Number.isFinite(prix) || prix <= 0) return null;
  return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(prix)} €`;
}
