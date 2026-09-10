import { estCouleurZone } from './palette';
import { TYPES_REGLE_ZONE, type TypeRegleZone, type ValeurRegleZone } from './types';

/**
 * Validation des charges utiles côté serveur. La RLS décide QUI écrit, ce
 * module décide CE QUI est écrit : un polygone à deux sommets ou un code
 * postal fantaisiste rendrait un secteur silencieusement inopérant.
 */

export type Invalide = { erreur: string };
export type Valide<T> = { valeur: T };
export type Verdict<T> = Valide<T> | Invalide;

export function estInvalide<T>(v: Verdict<T>): v is Invalide {
  return 'erreur' in v;
}

function objet(v: unknown): Record<string, unknown> | null {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

export function validerNomZone(v: unknown): Verdict<string> {
  if (typeof v !== 'string') return { erreur: 'Nom de zone manquant' };
  const nom = v.trim();
  if (nom === '') return { erreur: 'Le nom de la zone ne peut pas être vide' };
  if (nom.length > 60) return { erreur: 'Nom de zone trop long (60 caractères)' };
  return { valeur: nom };
}

export function validerCouleurZone(v: unknown): Verdict<string> {
  if (typeof v !== 'string' || !estCouleurZone(v)) {
    return { erreur: 'Couleur hors de la palette des zones' };
  }
  return { valeur: v };
}

/** 1 = lundi, 5 = vendredi. Null est un choix valable : pas de calendrier. */
export function validerJourSemaine(v: unknown): Verdict<number | null> {
  if (v === null || v === undefined) return { valeur: null };
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 1 || v > 5) {
    return { erreur: 'Jour de tournée invalide' };
  }
  return { valeur: v };
}

function validerAnneau(v: unknown): Verdict<[number, number][]> {
  if (!Array.isArray(v) || v.length < 4) {
    return { erreur: 'Un contour demande au moins trois sommets' };
  }
  const sommets: [number, number][] = [];
  for (const p of v) {
    if (
      !Array.isArray(p) ||
      p.length < 2 ||
      typeof p[0] !== 'number' ||
      typeof p[1] !== 'number' ||
      !Number.isFinite(p[0]) ||
      !Number.isFinite(p[1]) ||
      Math.abs(p[0]) > 180 ||
      Math.abs(p[1]) > 90
    ) {
      return { erreur: 'Coordonnée de contour hors des bornes WGS84' };
    }
    sommets.push([p[0], p[1]]);
  }
  const premier = sommets[0]!;
  const dernier = sommets[sommets.length - 1]!;
  // GeoJSON exige un anneau fermé ; l'éditeur l'oublie parfois.
  if (premier[0] !== dernier[0] || premier[1] !== dernier[1]) sommets.push(premier);
  return { valeur: sommets };
}

export function validerValeurRegle(
  type: TypeRegleZone,
  brut: unknown,
): Verdict<ValeurRegleZone> {
  const v = objet(brut);
  if (!v) return { erreur: 'Règle illisible' };

  switch (type) {
    case 'polygone': {
      const anneaux = v.coordinates;
      if (!Array.isArray(anneaux) || anneaux.length === 0) {
        return { erreur: 'Contour manquant' };
      }
      const valides: [number, number][][] = [];
      for (const anneau of anneaux) {
        const verdict = validerAnneau(anneau);
        if (estInvalide(verdict)) return verdict;
        valides.push(verdict.valeur);
      }
      return { valeur: { type: 'Polygon', coordinates: valides } };
    }
    case 'voie': {
      const nom = typeof v.nom_voie === 'string' ? v.nom_voie.trim() : '';
      if (nom === '') return { erreur: 'Nom de voie manquant' };
      const cp = typeof v.code_postal === 'string' ? v.code_postal.trim() : '';
      if (!/^\d{5}$/.test(cp)) return { erreur: 'Code postal de la voie invalide' };
      const parite = v.parite;
      if (parite !== 'toutes' && parite !== 'paires' && parite !== 'impaires') {
        return { erreur: 'Parité invalide' };
      }
      const borne = (x: unknown): Verdict<number | null> => {
        if (x === null || x === undefined || x === '') return { valeur: null };
        const n = typeof x === 'number' ? x : Number.parseInt(String(x), 10);
        if (!Number.isInteger(n) || n < 1 || n > 9999) return { erreur: 'Numéro invalide' };
        return { valeur: n };
      };
      const min = borne(v.numero_min);
      if (estInvalide(min)) return min;
      const max = borne(v.numero_max);
      if (estInvalide(max)) return max;
      if (min.valeur !== null && max.valeur !== null && min.valeur > max.valeur) {
        return { erreur: 'Plage de numéros inversée' };
      }
      return {
        valeur: {
          nom_voie: nom,
          code_postal: cp,
          parite,
          numero_min: min.valeur,
          numero_max: max.valeur,
        },
      };
    }
    case 'code_postal': {
      const cp = typeof v.code_postal === 'string' ? v.code_postal.trim() : '';
      if (!/^\d{5}$/.test(cp)) return { erreur: 'Code postal invalide' };
      return { valeur: { code_postal: cp } };
    }
    case 'parcelles': {
      const ids = v.parcelle_ids;
      if (!Array.isArray(ids)) return { erreur: 'Liste de parcelles manquante' };
      const propres = ids.filter((id): id is string => typeof id === 'string' && id.trim() !== '');
      if (propres.length === 0) return { erreur: 'Aucune parcelle fournie' };
      return { valeur: { parcelle_ids: propres.map((id) => id.trim()) } };
    }
  }
}

export function validerTypeRegle(v: unknown): Verdict<TypeRegleZone> {
  if (typeof v !== 'string' || !(TYPES_REGLE_ZONE as readonly string[]).includes(v)) {
    return { erreur: 'Type de règle inconnu' };
  }
  return { valeur: v as TypeRegleZone };
}
