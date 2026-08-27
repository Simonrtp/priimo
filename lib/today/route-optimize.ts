import type { GeoCoord } from '@/lib/carte/coords';
import { haversineM } from '@/lib/geo/distance';

/**
 * Ordonnancement d'une tournée à pied : boucle agence → arrêts → agence.
 *
 * Trois étages, du moins cher au plus juste :
 *  1. amorce au plus proche voisin depuis le départ ;
 *  2. amélioration 2-opt + Or-opt (déplacement de segments de 1 à 3 arrêts) ;
 *  3. optimum exact (Held-Karp) tant que la tournée tient sous 12 arrêts.
 *
 * L'optimum exact n'est retenu que s'il est *strictement* meilleur : à égalité
 * on garde l'amorce, l'ordre reste donc stable d'un recalcul à l'autre.
 */

/** Au-delà, Held-Karp (2^n · n²) devient trop lourd sur mobile. */
export const EXACT_MAX_STOPS = 12;

/** Au-delà, on se contente de l'amorce plus proche voisin. */
export const IMPROVE_MAX_STOPS = 60;

/** Marge en mètres sous laquelle deux tournées sont considérées équivalentes. */
const EPS = 1e-6;

/** Longueur maximale d'un segment déplacé par Or-opt. */
const OR_OPT_MAX_SEGMENT = 3;

const MAX_IMPROVE_ROUNDS = 40;

type Model = {
  /** Matrice (n+1)² — l'indice 0 est le départ. */
  d: number[][];
  n: number;
};

/**
 * Sans départ connu, un nœud virtuel à distance nulle de tous les arrêts
 * transforme le chemin ouvert (extrémités libres) en boucle fermée.
 */
function buildModel(stops: readonly GeoCoord[], origin: GeoCoord | null): Model {
  const n = stops.length;
  const size = n + 1;
  const d: number[][] = Array.from({ length: size }, () => new Array<number>(size).fill(0));

  for (let i = 0; i < n; i++) {
    if (origin) {
      const legM = haversineM(origin, stops[i]!);
      d[0]![i + 1] = legM;
      d[i + 1]![0] = legM;
    }
    for (let j = i + 1; j < n; j++) {
      const legM = haversineM(stops[i]!, stops[j]!);
      d[i + 1]![j + 1] = legM;
      d[j + 1]![i + 1] = legM;
    }
  }
  return { d, n };
}

/** Coût de la boucle 0 → order → 0. `order` contient des indices 1..n. */
function tourCost(order: readonly number[], model: Model): number {
  if (order.length === 0) return 0;
  let total = model.d[0]![order[0]!]!;
  for (let i = 0; i < order.length - 1; i++) {
    total += model.d[order[i]!]![order[i + 1]!]!;
  }
  return total + model.d[order[order.length - 1]!]![0]!;
}

/** Amorce : à chaque étape l'arrêt non visité le plus proche. */
function seedOrder(model: Model): number[] {
  const remaining: number[] = [];
  for (let i = 1; i <= model.n; i++) remaining.push(i);

  const order: number[] = [];
  let current = 0;
  while (remaining.length > 0) {
    let bestAt = 0;
    let bestD = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const legM = model.d[current]![remaining[i]!]!;
      if (legM < bestD) {
        bestD = legM;
        bestAt = i;
      }
    }
    current = remaining.splice(bestAt, 1)[0]!;
    order.push(current);
  }
  return order;
}

/** 2-opt (inversion de segment) puis Or-opt (déplacement de segment). */
function improve(seed: readonly number[], model: Model): number[] {
  let best = [...seed];
  let bestCost = tourCost(best, model);

  for (let round = 0; round < MAX_IMPROVE_ROUNDS; round++) {
    let progressed = false;

    for (let i = 0; i < best.length - 1; i++) {
      for (let j = i + 1; j < best.length; j++) {
        const candidate = [
          ...best.slice(0, i),
          ...best.slice(i, j + 1).reverse(),
          ...best.slice(j + 1),
        ];
        const cost = tourCost(candidate, model);
        if (cost < bestCost - EPS) {
          best = candidate;
          bestCost = cost;
          progressed = true;
        }
      }
    }

    for (let len = 1; len <= OR_OPT_MAX_SEGMENT; len++) {
      for (let start = 0; start + len <= best.length; start++) {
        const segment = best.slice(start, start + len);
        const rest = [...best.slice(0, start), ...best.slice(start + len)];
        const variants = len > 1 ? [segment, [...segment].reverse()] : [segment];
        for (const variant of variants) {
          for (let at = 0; at <= rest.length; at++) {
            const candidate = [...rest.slice(0, at), ...variant, ...rest.slice(at)];
            const cost = tourCost(candidate, model);
            if (cost < bestCost - EPS) {
              best = candidate;
              bestCost = cost;
              progressed = true;
            }
          }
        }
      }
    }

    if (!progressed) break;
  }

  return best;
}

/** Held-Karp : boucle optimale exacte à départ fixe. */
function exactOrder(model: Model): number[] {
  const n = model.n;
  const full = 1 << n;
  const cost = new Float64Array(full * n).fill(Infinity);
  const from = new Int16Array(full * n).fill(-1);

  for (let j = 0; j < n; j++) {
    cost[(1 << j) * n + j] = model.d[0]![j + 1]!;
  }

  for (let mask = 1; mask < full; mask++) {
    for (let j = 0; j < n; j++) {
      if ((mask & (1 << j)) === 0) continue;
      const here = cost[mask * n + j]!;
      if (!Number.isFinite(here)) continue;
      for (let k = 0; k < n; k++) {
        if ((mask & (1 << k)) !== 0) continue;
        const next = mask | (1 << k);
        const candidate = here + model.d[j + 1]![k + 1]!;
        if (candidate < cost[next * n + k]! - EPS) {
          cost[next * n + k] = candidate;
          from[next * n + k] = j;
        }
      }
    }
  }

  const last = full - 1;
  let endAt = 0;
  let bestTotal = Infinity;
  for (let j = 0; j < n; j++) {
    const total = cost[last * n + j]! + model.d[j + 1]![0]!;
    if (total < bestTotal - EPS) {
      bestTotal = total;
      endAt = j;
    }
  }

  const reversed: number[] = [];
  let mask = last;
  let node = endAt;
  while (node >= 0) {
    reversed.push(node + 1);
    const previous = from[mask * n + node]!;
    mask ^= 1 << node;
    node = previous;
  }
  return reversed.reverse();
}

/**
 * Ordonne les arrêts pour minimiser la marche totale, retour au départ compris.
 * Sans départ, minimise le chemin ouvert (extrémités libres).
 */
export function optimizeLoopOrder<T extends GeoCoord>(
  stops: readonly T[],
  origin: GeoCoord | null,
): T[] {
  if (stops.length <= 1) return [...stops];

  const model = buildModel(stops, origin);
  const seed = seedOrder(model);
  const heuristic = model.n <= IMPROVE_MAX_STOPS ? improve(seed, model) : seed;

  let winner = heuristic;
  if (model.n <= EXACT_MAX_STOPS) {
    const exact = exactOrder(model);
    if (tourCost(exact, model) < tourCost(heuristic, model) - EPS) {
      winner = exact;
    }
  }
  return winner.map((index) => stops[index - 1]!);
}

/** Marche totale de la boucle : départ → arrêts → départ. */
export function loopDistanceM(
  ordered: readonly GeoCoord[],
  origin: GeoCoord | null,
): number {
  if (ordered.length === 0) return 0;
  let total = 0;
  let previous: GeoCoord = origin ?? ordered[0]!;
  const start = origin ? 0 : 1;
  for (let i = start; i < ordered.length; i++) {
    total += haversineM(previous, ordered[i]!);
    previous = ordered[i]!;
  }
  if (origin) total += haversineM(previous, origin);
  return total;
}

/** Points à envoyer au routeur : la boucle repasse par le départ à la fin. */
export function loopWaypoints<T extends GeoCoord>(
  ordered: readonly T[],
  origin: GeoCoord | null,
): GeoCoord[] {
  if (ordered.length === 0) return [];
  if (!origin) return ordered.map((s) => ({ latitude: s.latitude, longitude: s.longitude }));
  return [
    origin,
    ...ordered.map((s) => ({ latitude: s.latitude, longitude: s.longitude })),
    origin,
  ];
}
