import { zoneDuLead, type LeadSituable } from './leads';
import { modeDuJour } from './jour';
import type { Zone } from './types';
import {
  CYCLE_DEFAUT_JOURS,
  classerFraicheur,
  cycleObserveJours,
  dernierPassageParAdresse,
  semainesArrondies,
  seuilRevoirJours,
  type NiveauFraicheur,
  type PassageObserve,
} from './fraicheur';

/**
 * Ce que montre la carte « Mon secteur » de l'Accueil.
 *
 * Un repère, pas un jugement : le contour, les points colorés selon la
 * fraîcheur de passage, et une phrase factuelle. Rien sur la façon de
 * travailler.
 */

export type PointSecteur = {
  id: string;
  latitude: number;
  longitude: number;
  niveau: NiveauFraicheur;
  dernierPassageJour: string | null;
};

export type RepartitionFraicheur = Record<NiveauFraicheur, number>;

export type ZoneDirecteur = {
  zone: Zone;
  titulaire: string | null;
  aRevoir: number;
};

export type ApercuSecteur = {
  zones: Zone[];
  points: PointSecteur[];
  repartition: RepartitionFraicheur;
  aRevoir: number;
  /** Seuil en semaines, seulement s'il a été observé. Le repli reste muet. */
  cycleSemaines: number | null;
  phrase: string | null;
  zonesDirecteur: ZoneDirecteur[];
};

const REPARTITION_VIDE: RepartitionFraicheur = {
  semaine: 0,
  cycle: 0,
  revoir: 0,
  jamais: 0,
};

function phraseFactuelle(aRevoir: number, cycleSemaines: number | null): string | null {
  if (aRevoir <= 0) return null;
  const n = aRevoir === 1 ? '1 adresse n’a' : `${aRevoir} adresses n’ont`;
  if (cycleSemaines === null) {
    return `${n} pas été passée${aRevoir > 1 ? 's' : ''} depuis trop longtemps.`;
  }
  return `${n} pas été passée${aRevoir > 1 ? 's' : ''} depuis plus de ${cycleSemaines} semaine${cycleSemaines > 1 ? 's' : ''}.`;
}

function cleAdresse(lead: LeadSituable): string {
  return (lead.banId ?? '').trim() || lead.id;
}

export function apercuSecteur<T extends LeadSituable>({
  leads,
  zones,
  profileId,
  estDirecteur,
  passages = [],
  repliCycleJours = CYCLE_DEFAUT_JOURS,
  titulaires = {},
  maintenant = new Date(),
}: {
  leads: readonly T[];
  zones: readonly Zone[];
  profileId: string;
  estDirecteur: boolean;
  passages?: readonly PassageObserve[];
  /** Fréquence cible de l'agence, ou le repli de 12 semaines. Jamais affichée. */
  repliCycleJours?: number;
  titulaires?: Readonly<Record<string, string>>;
  maintenant?: Date;
}): ApercuSecteur {
  const actives = zones.filter((z) => z.actif);
  const siennes = actives.filter((z) => z.assignedTo === profileId);
  const retenues = estDirecteur ? actives : siennes;

  if (retenues.length === 0) {
    return {
      zones: [],
      points: [],
      repartition: { ...REPARTITION_VIDE },
      aRevoir: 0,
      cycleSemaines: null,
      phrase: null,
      zonesDirecteur: [],
    };
  }

  const duJour = modeDuJour(zones, profileId, maintenant);
  const ordonnees =
    duJour.mode === 'secteur'
      ? [duJour.zone, ...retenues.filter((z) => z.id !== duJour.zone.id)]
      : retenues;

  const cycleMoi = cycleObserveJours(passages, profileId, repliCycleJours);
  const derniersParProfil = new Map<string, Map<string, string>>();
  const cycleParProfil = new Map<string, ReturnType<typeof cycleObserveJours>>();
  function derniersDe(id: string) {
    const connu = derniersParProfil.get(id);
    if (connu) return connu;
    const calcule = dernierPassageParAdresse(passages, id);
    derniersParProfil.set(id, calcule);
    return calcule;
  }
  function cycleDe(id: string) {
    const connu = cycleParProfil.get(id);
    if (connu) return connu;
    const calcule = cycleObserveJours(passages, id, repliCycleJours);
    cycleParProfil.set(id, calcule);
    return calcule;
  }
  const idsRetenus = new Set(retenues.map((z) => z.id));

  const points: PointSecteur[] = [];
  const repartition: RepartitionFraicheur = { ...REPARTITION_VIDE };
  const aRevoirParZone = new Map<string, number>();

  for (const lead of leads) {
    const zone = zoneDuLead(lead, actives);
    if (!zone || !idsRetenus.has(zone.id)) continue;
    const titulaire = estDirecteur ? (zone.assignedTo ?? profileId) : profileId;
    const dernier = derniersDe(titulaire).get(cleAdresse(lead)) ?? null;
    const niveau = classerFraicheur(dernier, maintenant, cycleDe(titulaire).jours);
    repartition[niveau] += 1;
    if (niveau === 'revoir' || niveau === 'jamais') {
      aRevoirParZone.set(zone.id, (aRevoirParZone.get(zone.id) ?? 0) + 1);
    }
    if (lead.latitude !== null && lead.longitude !== null) {
      points.push({
        id: lead.id,
        latitude: lead.latitude,
        longitude: lead.longitude,
        niveau,
        dernierPassageJour: dernier,
      });
    }
  }

  const aRevoir = repartition.revoir + repartition.jamais;
  const cycleSemaines = cycleMoi.observe
    ? semainesArrondies(seuilRevoirJours(cycleMoi.jours))
    : null;

  const zonesDirecteur: ZoneDirecteur[] = estDirecteur
    ? retenues.map((zone) => ({
        zone,
        titulaire: zone.assignedTo ? (titulaires[zone.assignedTo] ?? null) : null,
        aRevoir: aRevoirParZone.get(zone.id) ?? 0,
      }))
    : [];

  return {
    zones: ordonnees,
    points,
    repartition,
    aRevoir,
    cycleSemaines,
    phrase: phraseFactuelle(aRevoir, cycleSemaines),
    zonesDirecteur,
  };
}
