import { specificiteDansZone, zoneDeLAdresse } from '@/lib/zones/appartenance';
import type { AdresseAJuger, Zone } from '@/lib/zones/types';
import type { Annonce } from './types';

export function numeroVoie(brut: string | null): number | null {
  if (!brut) return null;
  const m = brut.trim().match(/^(\d+)/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

/** Une adresse à juger par parcelle connue. L'appartenance ne se stocke pas. */
export function adressesAJuger(annonce: Annonce): AdresseAJuger[] {
  const base = {
    latitude: annonce.latitude,
    longitude: annonce.longitude,
    nomVoie: annonce.adresseVoie,
    numero: numeroVoie(annonce.adresseNumero),
    codePostal: annonce.codePostal,
  };
  const parcelles = annonce.parcelleIds.length > 0 ? annonce.parcelleIds : [null];
  return parcelles.map((parcelleId) => ({ ...base, parcelleId }));
}

/**
 * Zone la plus précise qui contient l'annonce. À spécificité égale, l'ordre
 * des zones (celui de la base) décide, comme pour les leads.
 */
export function zoneDeLAnnonce(annonce: Annonce, zones: readonly Zone[]): Zone | null {
  let gagnante: Zone | null = null;
  let meilleure = -1;
  for (const adresse of adressesAJuger(annonce)) {
    const zone = zoneDeLAdresse(adresse, zones);
    if (!zone) continue;
    const spec = specificiteDansZone(adresse, zone) ?? 0;
    if (spec > meilleure) {
      meilleure = spec;
      gagnante = zone;
    }
  }
  return gagnante;
}

export function dansMonSecteur(
  annonce: Annonce,
  zones: readonly Zone[],
  opts: { directeur: boolean; profileId: string },
): boolean {
  const zone = zoneDeLAnnonce(annonce, zones);
  if (!zone) return false;
  if (opts.directeur) return true;
  return zone.assignedTo === opts.profileId;
}
