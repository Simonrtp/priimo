import { zoneDuLead, type LeadSituable } from './leads';
import { modeDuJour } from './jour';
import type { Zone } from './types';

/**
 * Ce que montre la carte « Mon secteur » de l'Accueil.
 *
 * Un repère, pas un outil : le contour de son secteur, les adresses qui
 * restent à travailler, et rien de plus. Le directeur voit à la place tout le
 * découpage de son agence.
 */

export type PointSecteur = { id: string; latitude: number; longitude: number; pris: boolean };

export type ApercuSecteur = {
  /** Secteurs à dessiner, celui du jour en tête. */
  zones: Zone[];
  points: PointSecteur[];
  aTravailler: number;
  dejaPrises: number;
};

export function apercuSecteur<T extends LeadSituable>({
  leads,
  zones,
  profileId,
  estDirecteur,
  maintenant = new Date(),
}: {
  leads: readonly T[];
  zones: readonly Zone[];
  profileId: string;
  estDirecteur: boolean;
  maintenant?: Date;
}): ApercuSecteur {
  const actives = zones.filter((z) => z.actif);
  const siennes = actives.filter((z) => z.assignedTo === profileId);
  const retenues = estDirecteur ? actives : siennes;

  if (retenues.length === 0) {
    return { zones: [], points: [], aTravailler: 0, dejaPrises: 0 };
  }

  // Le secteur du jour passe devant : c'est celui qu'on regarde le matin.
  const duJour = modeDuJour(zones, profileId, maintenant);
  const ordonnees =
    duJour.mode === 'secteur'
      ? [duJour.zone, ...retenues.filter((z) => z.id !== duJour.zone.id)]
      : retenues;

  const idsRetenus = new Set(retenues.map((z) => z.id));
  const points: PointSecteur[] = [];
  let aTravailler = 0;
  let dejaPrises = 0;

  for (const lead of leads) {
    const zone = zoneDuLead(lead, actives);
    if (!zone || !idsRetenus.has(zone.id)) continue;
    const pris = lead.stageId != null;
    if (pris) dejaPrises += 1;
    else aTravailler += 1;
    // Les adresses déjà prises comptent dans le sous-titre mais n'encombrent
    // pas la carte : on n'y montre que ce qui reste à faire.
    if (!pris && lead.latitude !== null && lead.longitude !== null) {
      points.push({ id: lead.id, latitude: lead.latitude, longitude: lead.longitude, pris });
    }
  }

  return { zones: ordonnees, points, aTravailler, dejaPrises };
}
