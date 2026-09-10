import { memeVoie } from './adresse';
import {
  SPECIFICITE_REGLE,
  type AdresseAJuger,
  type RegleZone,
  type ValeurPolygone,
  type Zone,
} from './types';

/**
 * À qui appartient une adresse — module unique, aucune duplication ailleurs.
 *
 * RÈGLE ABSOLUE : l'appartenance ne se stocke JAMAIS sur un lead, un contact
 * ou un bien. Elle se calcule à la lecture. Un négociateur qui part et dont la
 * zone est réattribuée ne doit pas voir l'historique de ses leads changer de
 * main : un lead pris reste attaché à LUI, pas à la zone.
 *
 * Ordre d'évaluation :
 *   1. les exclusions l'emportent toujours sur les inclusions ;
 *   2. si plusieurs zones correspondent, la plus spécifique gagne — parcelle,
 *      puis voie, puis polygone, puis code postal.
 *
 * Aucune extension PostGIS : le test point-dans-polygone est ici, en
 * TypeScript, sur du GeoJSON stocké en jsonb.
 */

/**
 * Lancer de rayon sur un anneau fermé, sommets en `[lng, lat]`. Un point
 * exactement sur une arête est indécidable en flottant : le résultat est
 * arbitraire mais stable, ce qui suffit pour deux zones voisines.
 */
function dansAnneau(adresse: { lat: number; lng: number }, anneau: readonly (readonly [number, number])[]): boolean {
  let dedans = false;
  for (let i = 0, j = anneau.length - 1; i < anneau.length; j = i++) {
    const [xi, yi] = anneau[i]!;
    const [xj, yj] = anneau[j]!;
    const traverse =
      yi > adresse.lat !== yj > adresse.lat &&
      adresse.lng < ((xj - xi) * (adresse.lat - yi)) / (yj - yi) + xi;
    if (traverse) dedans = !dedans;
  }
  return dedans;
}

/** Dans l'anneau extérieur et dans aucun trou. */
export function pointDansPolygone(
  point: { latitude: number | null; longitude: number | null },
  polygone: ValeurPolygone,
): boolean {
  if (point.latitude === null || point.longitude === null) return false;
  const anneaux = polygone.coordinates;
  const exterieur = anneaux[0];
  if (!exterieur || exterieur.length < 3) return false;

  const p = { lat: point.latitude, lng: point.longitude };
  if (!dansAnneau(p, exterieur)) return false;

  for (let i = 1; i < anneaux.length; i += 1) {
    const trou = anneaux[i]!;
    if (trou.length >= 3 && dansAnneau(p, trou)) return false;
  }
  return true;
}

function memeCodePostal(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  return a.trim() === b.trim();
}

/**
 * Une règle de voie ne se déclenche que sur ce qu'elle peut vérifier. Sans
 * numéro connu, une contrainte de parité ou de plage ne peut pas être tenue :
 * la règle ne s'applique pas, plutôt que de s'appliquer au hasard.
 */
function correspondVoie(adresse: AdresseAJuger, regle: Extract<RegleZone, { type: 'voie' }>): boolean {
  const { nom_voie, code_postal, parite, numero_min, numero_max } = regle.valeur;
  if (!memeVoie(adresse.nomVoie, nom_voie)) return false;
  if (code_postal.trim() !== '' && !memeCodePostal(adresse.codePostal, code_postal)) return false;

  const contrainte = parite !== 'toutes' || numero_min !== null || numero_max !== null;
  if (!contrainte) return true;
  if (adresse.numero === null) return false;

  if (parite === 'paires' && adresse.numero % 2 !== 0) return false;
  if (parite === 'impaires' && adresse.numero % 2 === 0) return false;
  if (numero_min !== null && adresse.numero < numero_min) return false;
  if (numero_max !== null && adresse.numero > numero_max) return false;
  return true;
}

export function regleCorrespond(adresse: AdresseAJuger, regle: RegleZone): boolean {
  switch (regle.type) {
    case 'polygone':
      return pointDansPolygone(adresse, regle.valeur);
    case 'voie':
      return correspondVoie(adresse, regle);
    case 'code_postal':
      return memeCodePostal(adresse.codePostal, regle.valeur.code_postal);
    case 'parcelles':
      return (
        adresse.parcelleId !== null && regle.valeur.parcelle_ids.includes(adresse.parcelleId)
      );
  }
}

/**
 * Spécificité de la règle d'inclusion la plus précise qui retient l'adresse,
 * ou `null` si la zone ne la revendique pas. Une seule exclusion suffit à
 * rendre `null`, même si dix inclusions correspondent.
 */
export function specificiteDansZone(adresse: AdresseAJuger, zone: Zone): number | null {
  if (!zone.actif) return null;

  for (const regle of zone.regles) {
    if (!regle.inclusion && regleCorrespond(adresse, regle)) return null;
  }

  let meilleure: number | null = null;
  for (const regle of zone.regles) {
    if (!regle.inclusion) continue;
    if (!regleCorrespond(adresse, regle)) continue;
    const specificite = SPECIFICITE_REGLE[regle.type];
    if (meilleure === null || specificite > meilleure) meilleure = specificite;
  }
  return meilleure;
}

export function adresseDansZone(adresse: AdresseAJuger, zone: Zone): boolean {
  return specificiteDansZone(adresse, zone) !== null;
}

/**
 * Toutes les zones qui revendiquent l'adresse, de la plus spécifique à la
 * moins. Sert à signaler les chevauchements : deux zones qui répondent au même
 * niveau de précision, c'est un recouvrement à montrer au directeur.
 */
export function zonesDeLAdresse(adresse: AdresseAJuger, zones: readonly Zone[]): Zone[] {
  return zones
    .map((zone) => ({ zone, specificite: specificiteDansZone(adresse, zone) }))
    .filter((c): c is { zone: Zone; specificite: number } => c.specificite !== null)
    .sort((a, b) => b.specificite - a.specificite)
    .map((c) => c.zone);
}

/**
 * La zone d'une adresse, ou `null` si aucune ne la couvre — « hors secteur
 * attribué » est un état normal, pas une erreur. À spécificité égale, la
 * première zone de la liste gagne : l'ordre d'appel décide, et il est stable
 * parce que les zones arrivent triées de la base.
 */
export function zoneDeLAdresse(adresse: AdresseAJuger, zones: readonly Zone[]): Zone | null {
  return zonesDeLAdresse(adresse, zones)[0] ?? null;
}
