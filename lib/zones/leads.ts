import { adresseAJuger } from './adresse';
import { zoneDeLAdresse } from './appartenance';
import type { Zone } from './types';

/**
 * Répartition des leads livrés entre le secteur de l'agent et la file agence.
 *
 * Le principe : un lead qui appartient à quelqu'un se prend, un lead qui n'est
 * à personne reste. On sépare donc franchement ce dont l'agent est responsable
 * de ce qui traîne, et on dit toujours POURQUOI un lead est dans la file
 * agence — sans mention, cette file redevient le dépotoir qu'elle était.
 *
 * Le portillon ne change pas : appartenir à une zone ne prend pas le lead.
 * L'agent doit toujours le prendre explicitement.
 */

/**
 * Délai laissé au titulaire d'une zone avant que ses leads non pris ne soient
 * proposés au reste de l'agence. Sept jours : assez pour une semaine de
 * terrain, assez court pour qu'un lead ne meure pas dans un secteur inactif.
 */
export const JOURS_AVANT_OUVERTURE_AGENCE = 7;

const MS_PAR_JOUR = 86_400_000;

/** Le minimum qu'un lead doit porter pour être situé et daté. */
export type LeadSituable = {
  id: string;
  address: string;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
  assignedTo: string | null;
  stageId: string | null;
  deliveredAt?: string | null;
  createdAt: string;
  banId?: string | null;
};

export type MentionAgence =
  | { kind: 'hors_secteur' }
  /** Dans le secteur d'un collègue, mais oublié depuis trop longtemps. */
  | { kind: 'zone_collegue'; zoneNom: string; prenom: string | null; jours: number };

export type LeadAgence<T> = { lead: T; mention: MentionAgence };

export type GroupesSecteur<T> = {
  /** La zone de l'agent connecté, s'il en a une. */
  zone: Zone | null;
  /** Les adresses de sa zone : ce dont il est responsable. */
  monSecteur: T[];
  /**
   * Ce qu'il a pris ailleurs. La spec ne prévoyait pas ce cas, mais prendre un
   * lead de la file agence le crée aussitôt : le masquer ferait disparaître un
   * lead que l'agent travaille déjà.
   */
  mesHorsSecteur: T[];
  /** La file agence, chaque lead avec la raison de sa présence. */
  agence: LeadAgence<T>[];
};

/** Date de référence d'un lead : sa livraison, sinon sa création. */
function dateReference(lead: LeadSituable): number {
  const t = Date.parse(lead.deliveredAt ?? lead.createdAt);
  return Number.isFinite(t) ? t : Number.NaN;
}

export function joursDepuisLivraison(lead: LeadSituable, maintenant: Date): number {
  const t = dateReference(lead);
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, Math.floor((maintenant.getTime() - t) / MS_PAR_JOUR));
}

/** Un lead est pris dès qu'il est entré dans le pipeline. */
function estPris(lead: LeadSituable): boolean {
  return lead.stageId != null;
}

export function zoneDuLead<T extends LeadSituable>(lead: T, zones: readonly Zone[]): Zone | null {
  return zoneDeLAdresse(
    adresseAJuger({
      address: lead.address,
      postalCode: lead.postalCode,
      latitude: lead.latitude,
      longitude: lead.longitude,
    }),
    zones,
  );
}

export function pointDansZone(
  point: { latitude: number; longitude: number; postalCode?: string | null },
  zone: Zone,
): boolean {
  return (
    zoneDeLAdresse(
      adresseAJuger({
        postalCode: point.postalCode,
        latitude: point.latitude,
        longitude: point.longitude,
      }),
      [zone],
    )?.id === zone.id
  );
}

/**
 * Trois files pour un négociateur, dans l'ordre où il doit les lire.
 *
 * Un lead non pris dans la zone d'un collègue reste invisible pendant sept
 * jours : c'est son secteur, il a le temps de le travailler. Passé ce délai il
 * bascule dans la file agence avec la mention qui dit d'où il vient.
 */
export function grouperParSecteur<T extends LeadSituable>({
  leads,
  zones,
  profileId,
  prenoms = {},
  maintenant = new Date(),
}: {
  leads: readonly T[];
  zones: readonly Zone[];
  profileId: string;
  /** profileId → prénom, pour écrire « Zone de Thomas ». */
  prenoms?: Readonly<Record<string, string | null>>;
  maintenant?: Date;
}): GroupesSecteur<T> {
  const maZone = zones.find((z) => z.actif && z.assignedTo === profileId) ?? null;

  const monSecteur: T[] = [];
  const mesHorsSecteur: T[] = [];
  const agence: LeadAgence<T>[] = [];

  for (const lead of leads) {
    const zone = zoneDuLead(lead, zones);
    const aMoi = lead.assignedTo === profileId;

    if (maZone && zone?.id === maZone.id) {
      monSecteur.push(lead);
      continue;
    }

    if (aMoi) {
      mesHorsSecteur.push(lead);
      continue;
    }

    if (!zone || zone.assignedTo === null) {
      agence.push({ lead, mention: { kind: 'hors_secteur' } });
      continue;
    }

    // Zone d'un collègue : on ne la lui prend pas avant le délai.
    if (estPris(lead)) continue;
    const jours = joursDepuisLivraison(lead, maintenant);
    if (jours <= JOURS_AVANT_OUVERTURE_AGENCE) continue;

    agence.push({
      lead,
      mention: {
        kind: 'zone_collegue',
        zoneNom: zone.nom,
        prenom: prenoms[zone.assignedTo] ?? null,
        jours,
      },
    });
  }

  return { zone: maZone, monSecteur, mesHorsSecteur, agence };
}

export function libelleMention(mention: MentionAgence): string {
  if (mention.kind === 'hors_secteur') return 'Hors secteur attribué';
  const qui = mention.prenom ?? mention.zoneNom;
  return `Zone de ${qui}, non pris depuis ${mention.jours} jours`;
}

export type SousGroupeAgence<T> = { cle: string; titre: string; leads: T[] };

/**
 * La file agence, découpée par raison de présence. Une seule liste mélangée
 * redeviendrait un dépotoir : l'agent doit voir d'un coup d'œil ce qui
 * n'appartient à personne et ce qu'un collègue a laissé filer.
 *
 * Les orphelins d'abord — ce sont les seuls que personne ne réclame.
 */
export function sousGroupesAgence<T>(
  agence: readonly LeadAgence<T>[],
): SousGroupeAgence<T>[] {
  const horsSecteur: T[] = [];
  const parZone = new Map<string, { titre: string; leads: T[] }>();

  for (const { lead, mention } of agence) {
    if (mention.kind === 'hors_secteur') {
      horsSecteur.push(lead);
      continue;
    }
    const cle = mention.zoneNom;
    const titre = `Zone de ${mention.prenom ?? mention.zoneNom} · non pris depuis plus de ${JOURS_AVANT_OUVERTURE_AGENCE} jours`;
    const groupe = parZone.get(cle);
    if (groupe) groupe.leads.push(lead);
    else parZone.set(cle, { titre, leads: [lead] });
  }

  const groupes: SousGroupeAgence<T>[] = [];
  if (horsSecteur.length > 0) {
    groupes.push({ cle: 'hors-secteur', titre: 'Hors secteur attribué', leads: horsSecteur });
  }
  for (const [cle, { titre, leads }] of parZone) {
    groupes.push({ cle, titre, leads });
  }
  return groupes;
}

export type StatistiqueZone<T> = {
  zone: Zone;
  leads: T[];
  total: number;
  pris: number;
  /** Part des leads de la zone entrés dans le pipeline, en pourcentage entier. */
  tauxPrise: number;
};

/**
 * Vue directeur : le taux de prise par zone, et ce que personne ne couvre.
 * Un secteur à 20 % de prise n'est pas un secteur pauvre, c'est un secteur
 * qu'on n'a pas travaillé — et c'est précisément ce qu'il faut voir.
 */
export function statistiquesParZone<T extends LeadSituable>(
  leads: readonly T[],
  zones: readonly Zone[],
): { parZone: StatistiqueZone<T>[]; horsZone: T[] } {
  const actives = zones.filter((z) => z.actif);
  const parId = new Map<string, T[]>(actives.map((z) => [z.id, []]));
  const horsZone: T[] = [];

  for (const lead of leads) {
    const zone = zoneDuLead(lead, actives);
    if (!zone) {
      horsZone.push(lead);
      continue;
    }
    parId.get(zone.id)?.push(lead);
  }

  const parZone = actives.map((zone) => {
    const liste = parId.get(zone.id) ?? [];
    const pris = liste.filter(estPris).length;
    return {
      zone,
      leads: liste,
      total: liste.length,
      pris,
      tauxPrise: liste.length === 0 ? 0 : Math.round((pris / liste.length) * 100),
    };
  });

  return { parZone, horsZone };
}
