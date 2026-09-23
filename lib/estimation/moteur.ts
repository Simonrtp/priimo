/**
 * Cœur du moteur d’estimation par comparaison.
 * Jamais 0 € : une valeur avec fiabilité, ou une impossibilité motivée.
 */

import { MOTEUR_CONFIG } from '@/lib/estimation/moteur-config';

export type MotifImpossibleCode =
  | 'surface_manquante'
  | 'type_manquant'
  | 'adresse_incomplete'
  | 'aucune_vente_zone'
  | 'aucune_vente_apres_nettoyage'
  | 'pas_assez_comparables'
  | 'valeur_incalculable';

export type MotifImpossible = {
  code: MotifImpossibleCode;
  motif: string;
  action: string;
};

export type VenteBrute = {
  id: string;
  idMutation: string | null;
  dateMutation: string;
  valeurFonciere: number | null;
  surfaceM2: number | null;
  prixM2: number | null;
  typeLocal: string | null;
  natureMutation: string | null;
  banId: string | null;
  parcelleId: string | null;
  lat: number | null;
  lng: number | null;
  adresse: string | null;
  codePostal: string | null;
  surfaceTerrain: number | null;
};

export type MotifExclusion =
  | 'nature'
  | 'plusieurs_logements'
  | 'sans_surface'
  | 'sans_valeur'
  | 'aberrant_mad'
  | 'type'
  | 'retiree_par_agent'
  | 'vente_cible'
  | 'posterieure'
  | 'surface_ecart';

export type VenteExclue = {
  id: string;
  motif: MotifExclusion;
  prixM2: number | null;
};

export type VenteRetenue = {
  id: string;
  idMutation: string | null;
  date: string;
  surfaceM2: number;
  prix: number;
  prixM2: number;
  prixM2Actualise: number;
  poids: number;
  distanceM: number | null;
  sameBuilding: boolean;
  sameStreet: boolean;
  voie: string | null;
};

export type AjustementApplique = {
  id: string;
  label: string;
  pct: number | null;
  amountEur: number;
};

export type FiabiliteLabel = 'élevée' | 'moyenne' | 'faible';

export type IndiceLocal = {
  niveau: 'code_postal' | 'arrondissement' | 'commune';
  actuel: number;
  trimestres: Array<{ cle: string; mediane: number; n: number }>;
};

export type MoteurInput = {
  surfaceM2: number;
  propertyType: 'appartement' | 'maison';
  floor: string | null;
  hasElevator: boolean | null;
  dernierEtage: boolean | null;
  conditionRating: 1 | 2 | 3 | 4 | null;
  dpeClass: string | null;
  balconTerrasse: boolean;
  annexes: Array<{ libelle: string; valorisationEur: number | null }>;
  terrainM2: number | null;
  exclusIds?: readonly string[];
};

export type MoteurResultat = {
  available: boolean;
  value: number | null;
  low: number | null;
  high: number | null;
  pricePerM2: number | null;
  reliability: FiabiliteLabel;
  reliabilityScore: number;
  retenues: VenteRetenue[];
  exclues: VenteExclue[];
  ajustements: AjustementApplique[];
  indice: IndiceLocal | null;
  radiusM: number | null;
  fenetreMois: number | null;
  impossible: MotifImpossible | null;
};

export function impossible(
  code: MotifImpossibleCode,
  motif: string,
  action: string,
): MoteurResultat {
  return {
    available: false,
    value: null,
    low: null,
    high: null,
    pricePerM2: null,
    reliability: 'faible',
    reliabilityScore: 0,
    retenues: [],
    exclues: [],
    ajustements: [],
    indice: null,
    radiusM: null,
    fenetreMois: null,
    impossible: { code, motif, action },
  };
}

export function motifDepuisSaisie(input: {
  surfaceM2: number | null;
  propertyType: 'appartement' | 'maison' | null;
  latitude: number | null;
  longitude: number | null;
  postalCode: string | null;
}): MotifImpossible | null {
  if (input.surfaceM2 == null || input.surfaceM2 <= 0) {
    return {
      code: 'surface_manquante',
      motif: 'Surface du bien manquante.',
      action: 'Saisissez la surface habitable, ou le prix à la main.',
    };
  }
  if (!input.propertyType) {
    return {
      code: 'type_manquant',
      motif: 'Type de bien manquant.',
      action: 'Indiquez appartement ou maison, ou saisissez le prix à la main.',
    };
  }
  if (
    input.latitude == null ||
    input.longitude == null ||
    !input.postalCode ||
    !/^\d{5}$/.test(input.postalCode)
  ) {
    return {
      code: 'adresse_incomplete',
      motif: 'Adresse incomplète : position ou code postal manquant.',
      action: 'Retapez l’adresse pour la rattacher, ou saisissez le prix à la main.',
    };
  }
  return null;
}

export function arrondirMillier(n: number): number | null {
  if (!Number.isFinite(n) || n <= 0) return null;
  const r = Math.round(n / 1000) * 1000;
  return r > 0 ? r : null;
}

export function mediane(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1]! + s[mid]!) / 2 : s[mid]!;
}

export function ecartAbsoluMedian(values: readonly number[]): number | null {
  const med = mediane(values);
  if (med == null) return null;
  return mediane(values.map((v) => Math.abs(v - med)));
}

export function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function voieNormalisee(adresse: string | null): string | null {
  if (!adresse?.trim()) return null;
  const withoutNum = adresse.trim().replace(/^\d+\s*(bis|ter|quater)?\s*/i, '');
  const beforeCp = withoutNum.replace(/\s+\d{5}\b.*$/, '').trim();
  const n = (beforeCp || withoutNum)
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('fr')
    .replace(/\s+/g, ' ')
    .trim();
  return n || null;
}

export function trimestreCle(dateIso: string): string | null {
  const t = Date.parse(dateIso);
  if (!Number.isFinite(t)) return null;
  const d = new Date(t);
  const q = Math.floor(d.getUTCMonth() / 3) + 1;
  return `${d.getUTCFullYear()}-T${q}`;
}

export function typeLocalOk(
  typeLocal: string | null,
  propertyType: 'appartement' | 'maison',
): boolean {
  const t = (typeLocal ?? '').toLocaleLowerCase('fr');
  if (propertyType === 'maison') return /maison/.test(t);
  return /appart/.test(t);
}

export function prixM2De(v: Pick<VenteBrute, 'prixM2' | 'valeurFonciere' | 'surfaceM2'>): number | null {
  if (v.prixM2 != null && Number.isFinite(v.prixM2) && v.prixM2 > 0) return v.prixM2;
  if (
    v.valeurFonciere != null &&
    v.surfaceM2 != null &&
    v.valeurFonciere > 0 &&
    v.surfaceM2 > 0
  ) {
    return v.valeurFonciere / v.surfaceM2;
  }
  return null;
}

export function estVenteSimple(nature: string | null | undefined): boolean {
  if (nature == null || nature.trim() === '') return true;
  return /^vente$/i.test(nature.trim());
}

export function nettoyerVentes(
  ventes: readonly VenteBrute[],
  propertyType: 'appartement' | 'maison',
  opts: { exclusIds?: readonly string[]; excludeMutationId?: string | null; avant?: string | null } = {},
): { candidates: VenteBrute[]; exclues: VenteExclue[] } {
  const exclues: VenteExclue[] = [];
  const parMutation = new Map<string, number>();
  for (const v of ventes) {
    if (!v.idMutation) continue;
    if (typeLocalOk(v.typeLocal, propertyType)) {
      parMutation.set(v.idMutation, (parMutation.get(v.idMutation) ?? 0) + 1);
    }
  }

  const keep: VenteBrute[] = [];
  for (const v of ventes) {
    const pm2 = prixM2De(v);
    if (opts.exclusIds?.includes(v.id)) {
      exclues.push({ id: v.id, motif: 'retiree_par_agent', prixM2: pm2 });
      continue;
    }
    if (opts.excludeMutationId && v.idMutation && v.idMutation === opts.excludeMutationId) {
      exclues.push({ id: v.id, motif: 'vente_cible', prixM2: pm2 });
      continue;
    }
    if (opts.avant && v.dateMutation >= opts.avant) {
      exclues.push({ id: v.id, motif: 'posterieure', prixM2: pm2 });
      continue;
    }
    if (!estVenteSimple(v.natureMutation)) {
      exclues.push({ id: v.id, motif: 'nature', prixM2: pm2 });
      continue;
    }
    if (!typeLocalOk(v.typeLocal, propertyType)) {
      exclues.push({ id: v.id, motif: 'type', prixM2: pm2 });
      continue;
    }
    if (v.idMutation && (parMutation.get(v.idMutation) ?? 0) > 1) {
      exclues.push({ id: v.id, motif: 'plusieurs_logements', prixM2: pm2 });
      continue;
    }
    if (v.surfaceM2 == null || v.surfaceM2 <= 0) {
      exclues.push({ id: v.id, motif: 'sans_surface', prixM2: pm2 });
      continue;
    }
    if (v.valeurFonciere == null || v.valeurFonciere <= 0) {
      exclues.push({ id: v.id, motif: 'sans_valeur', prixM2: pm2 });
      continue;
    }
    if (pm2 == null || pm2 <= 0) {
      exclues.push({ id: v.id, motif: 'sans_valeur', prixM2: null });
      continue;
    }
    keep.push(v);
  }

  const prix = keep.map((v) => prixM2De(v)!);
  const med = mediane(prix);
  const mad = ecartAbsoluMedian(prix);
  if (med == null || mad == null || mad === 0 || keep.length < 5) {
    return { candidates: keep, exclues };
  }
  const seuil = MOTEUR_CONFIG.MAD_SEUIL * mad;
  const afterMad: VenteBrute[] = [];
  for (const v of keep) {
    const pm2 = prixM2De(v)!;
    if (Math.abs(pm2 - med) > seuil) {
      exclues.push({ id: v.id, motif: 'aberrant_mad', prixM2: pm2 });
    } else {
      afterMad.push(v);
    }
  }
  return { candidates: afterMad, exclues };
}

export function construireIndice(
  ventes: readonly VenteBrute[],
  maintenant = new Date(),
): IndiceLocal | null {
  const buckets = new Map<string, number[]>();
  for (const v of ventes) {
    const pm2 = prixM2De(v);
    const cle = trimestreCle(v.dateMutation);
    if (pm2 == null || !cle) continue;
    const list = buckets.get(cle) ?? [];
    list.push(pm2);
    buckets.set(cle, list);
  }
  const trimestres = [...buckets.entries()]
    .map(([cle, vals]) => ({ cle, mediane: mediane(vals)!, n: vals.length }))
    .filter((t) => t.mediane > 0)
    .sort((a, b) => a.cle.localeCompare(b.cle));
  if (trimestres.length === 0) return null;

  const lisses = trimestres.map((t, i) => {
    const voisins = [trimestres[i - 1], t, trimestres[i + 1]].filter(Boolean) as typeof trimestres;
    return { ...t, mediane: mediane(voisins.map((x) => x.mediane))! };
  });

  const riches = lisses.filter((t) => t.n >= MOTEUR_CONFIG.MIN_VENTES_TRIMESTRE);
  const actuelCle = trimestreCle(maintenant.toISOString().slice(0, 10));
  const actuel =
    (actuelCle ? lisses.find((t) => t.cle === actuelCle)?.mediane : null) ??
    lisses[lisses.length - 1]!.mediane;

  const niveau: IndiceLocal['niveau'] =
    riches.length >= MOTEUR_CONFIG.MIN_TRIMESTRES_INDICE ? 'code_postal' : 'commune';
  return { niveau, actuel, trimestres: lisses };
}

export function indiceMaigre(indice: IndiceLocal | null): boolean {
  if (!indice) return true;
  const riches = indice.trimestres.filter((t) => t.n >= MOTEUR_CONFIG.MIN_VENTES_TRIMESTRE);
  return riches.length < MOTEUR_CONFIG.MIN_TRIMESTRES_INDICE;
}

export function actualiserPrixM2(prixM2: number, dateIso: string, indice: IndiceLocal | null): number {
  if (!indice || indice.actuel <= 0) return prixM2;
  const cle = trimestreCle(dateIso);
  const duTrimestre = cle ? indice.trimestres.find((t) => t.cle === cle)?.mediane : null;
  if (duTrimestre == null || duTrimestre <= 0) return prixM2;
  return prixM2 * (indice.actuel / duTrimestre);
}

export function medianePonderee(pairs: readonly { valeur: number; poids: number }[]): number | null {
  const ok = pairs.filter((p) => p.poids > 0 && Number.isFinite(p.valeur));
  if (ok.length === 0) return null;
  const sorted = [...ok].sort((a, b) => a.valeur - b.valeur);
  const total = sorted.reduce((s, p) => s + p.poids, 0);
  if (total <= 0) return mediane(sorted.map((p) => p.valeur));
  let acc = 0;
  for (const p of sorted) {
    acc += p.poids;
    if (acc >= total / 2) return p.valeur;
  }
  return sorted[sorted.length - 1]!.valeur;
}

/** Bornes issues des comparables pondérés. Jamais un ± fixe. */
export function fourchetteDepuisDispersion(
  prixVentes: readonly { valeur: number; poids: number }[],
  value: number,
): { low: number | null; high: number | null } {
  const q20 = quantilePondere(prixVentes, 0.2);
  const q80 = quantilePondere(prixVentes, 0.8);
  let low = q20 != null ? arrondirMillier(q20) : null;
  let high = q80 != null ? arrondirMillier(q80) : null;
  const bruts = prixVentes.map((p) => p.valeur).filter((n) => Number.isFinite(n) && n > 0);
  const mini = bruts.length > 0 ? Math.min(...bruts) : null;
  const maxi = bruts.length > 0 ? Math.max(...bruts) : null;
  if (low != null && low >= value && mini != null && mini < value) low = arrondirMillier(mini);
  if (high != null && high <= value && maxi != null && maxi > value) high = arrondirMillier(maxi);
  if (low != null && low >= value) low = null;
  if (high != null && high <= value) high = null;
  if (low != null && high != null && low >= high) {
    low = null;
    high = null;
  }
  return { low, high };
}

export function quantilePondere(
  pairs: readonly { valeur: number; poids: number }[],
  q: number,
): number | null {
  const ok = pairs.filter((p) => p.poids > 0 && Number.isFinite(p.valeur));
  if (ok.length === 0) return null;
  const sorted = [...ok].sort((a, b) => a.valeur - b.valeur);
  const total = sorted.reduce((s, p) => s + p.poids, 0);
  if (total <= 0) return mediane(sorted.map((p) => p.valeur));
  let acc = 0;
  for (const p of sorted) {
    acc += p.poids;
    if (acc / total >= q) return p.valeur;
  }
  return sorted[sorted.length - 1]!.valeur;
}

export function poidsVente(args: {
  distanceM: number | null;
  dateIso: string;
  surfaceM2: number;
  surfaceCible: number;
  sameBuilding: boolean;
  sameStreet: boolean;
  maintenant?: Date;
}): number {
  const P = MOTEUR_CONFIG.POIDS;
  const dist = args.distanceM ?? 800;
  let wDist = 1 / (1 + dist / P.DIST_REF_M);
  if (args.sameBuilding) wDist *= P.IMMEUBLE;
  else if (args.sameStreet) wDist *= P.RUE;
  const ageMs = (args.maintenant ?? new Date()).getTime() - Date.parse(args.dateIso);
  const ageMois = Number.isFinite(ageMs) ? ageMs / (30.44 * 24 * 3600 * 1000) : 24;
  const wAge = Math.exp(-Math.max(0, ageMois) / P.AGE_REF_MOIS);
  const ratio = args.surfaceM2 > 0 && args.surfaceCible > 0 ? Math.log(args.surfaceM2 / args.surfaceCible) : 0;
  const wSurf = Math.exp(-(ratio * ratio) / (2 * P.SURFACE_SIGMA * P.SURFACE_SIGMA));
  return wDist * wAge * wSurf;
}

export function penteSurface(ventes: readonly { surfaceM2: number; prixM2: number }[]): number | null {
  if (ventes.length < 8) return null;
  const xs = ventes.map((v) => Math.log(v.surfaceM2));
  const ys = ventes.map((v) => Math.log(v.prixM2));
  const mx = mediane(xs);
  const my = mediane(ys);
  if (mx == null || my == null) return null;
  let num = 0;
  let den = 0;
  for (let i = 0; i < xs.length; i++) {
    const dx = xs[i]! - mx;
    num += dx * (ys[i]! - my);
    den += dx * dx;
  }
  if (den <= 0) return null;
  const slope = num / den;
  if (!Number.isFinite(slope) || slope > 0.2 || slope < -1) return null;
  return slope;
}

export function corrigerSurface(
  pm2: number,
  surfaceCible: number,
  surfaceRef: number,
  pente: number | null,
): number {
  if (pente == null || surfaceCible <= 0 || surfaceRef <= 0) return pm2;
  return pm2 * (surfaceCible / surfaceRef) ** pente;
}

function parseNiveau(floor: string | null): number | null {
  if (!floor) return null;
  const raw = floor.trim();
  if (/^rdc$/i.test(raw) || raw === '0') return 0;
  if (raw === '20+') return 20;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
}

export function ajustementsMoteur(
  input: MoteurInput,
  baseEur: number,
): AjustementApplique[] {
  const out: AjustementApplique[] = [];
  const add = (id: string, label: string, pct: number | null, amount: number) => {
    if (amount === 0 && (pct == null || pct === 0)) return;
    out.push({ id, label, pct, amountEur: Math.round(amount) });
  };
  const niveau = parseNiveau(input.floor);
  if (input.propertyType === 'appartement' && niveau === 0) {
    add('rdc', `Rez-de-chaussée : ${pctLabel(MOTEUR_CONFIG.ETAGE.RDC_PCT)}`, MOTEUR_CONFIG.ETAGE.RDC_PCT, baseEur * MOTEUR_CONFIG.ETAGE.RDC_PCT);
  }
  if (input.propertyType === 'appartement' && input.dernierEtage === true && niveau !== 0) {
    add(
      'dernier',
      `Dernier étage : ${pctLabel(MOTEUR_CONFIG.ETAGE.DERNIER_PCT)}`,
      MOTEUR_CONFIG.ETAGE.DERNIER_PCT,
      baseEur * MOTEUR_CONFIG.ETAGE.DERNIER_PCT,
    );
  }
  if (
    input.propertyType === 'appartement' &&
    niveau != null &&
    niveau >= MOTEUR_CONFIG.ETAGE.ELEVE_DES &&
    input.hasElevator === false
  ) {
    add(
      'sans_asc',
      `Étage élevé sans ascenseur : ${pctLabel(MOTEUR_CONFIG.ETAGE.ELEVE_SANS_ASC_PCT)}`,
      MOTEUR_CONFIG.ETAGE.ELEVE_SANS_ASC_PCT,
      baseEur * MOTEUR_CONFIG.ETAGE.ELEVE_SANS_ASC_PCT,
    );
  } else if (input.propertyType === 'appartement' && input.hasElevator === true) {
    add(
      'ascenseur',
      `Ascenseur : ${pctLabel(MOTEUR_CONFIG.ETAGE.ASCENSEUR_PCT)}`,
      MOTEUR_CONFIG.ETAGE.ASCENSEUR_PCT,
      baseEur * MOTEUR_CONFIG.ETAGE.ASCENSEUR_PCT,
    );
  }
  if (input.balconTerrasse) {
    add(
      'terrasse',
      `Balcon ou terrasse : ${pctLabel(MOTEUR_CONFIG.BALCON_TERRASSE_PCT)}`,
      MOTEUR_CONFIG.BALCON_TERRASSE_PCT,
      baseEur * MOTEUR_CONFIG.BALCON_TERRASSE_PCT,
    );
  }
  if (input.conditionRating != null) {
    const pct = MOTEUR_CONFIG.ETAT[input.conditionRating] ?? 0;
    const labels: Record<number, string> = {
      1: 'À rénover',
      2: 'État correct',
      3: 'Bon état',
      4: 'Excellent état',
    };
    add('etat', `${labels[input.conditionRating] ?? 'État'} : ${pctLabel(pct)}`, pct, baseEur * pct);
  }
  if (input.dpeClass) {
    const letter = input.dpeClass.toUpperCase();
    const pct = MOTEUR_CONFIG.DPE[letter] ?? 0;
    if (pct !== 0) add('dpe', `DPE ${letter} : ${pctLabel(pct)}`, pct, baseEur * pct);
  }
  for (const a of input.annexes) {
    const n = a.libelle.toLocaleLowerCase('fr');
    const kind = n.includes('box')
      ? 'box'
      : n.includes('parking') || n.includes('garage')
        ? 'parking'
        : n.includes('cave') || n.includes('cellier')
          ? 'cave'
          : null;
    if (!kind) continue;
    const amount = a.valorisationEur != null && a.valorisationEur > 0
      ? a.valorisationEur
      : MOTEUR_CONFIG.ANNEXES_EUR[kind];
    const lib = kind === 'cave' ? 'Cave' : kind === 'box' ? 'Box' : 'Parking';
    add(`annexe_${kind}`, `${lib} : +${amount.toLocaleString('fr-FR')} €`, null, amount);
  }
  return out;
}

function pctLabel(pct: number): string {
  const n = Math.round(pct * 100);
  if (n > 0) return `+${n} %`;
  if (n < 0) return `−${Math.abs(n)} %`;
  return '0 %';
}

export function scorerFiabilite(args: {
  n: number;
  distances: readonly number[];
  agesMois: readonly number[];
  prixM2: readonly number[];
}): { label: FiabiliteLabel; score: number } {
  const n = args.n;
  const medDist = mediane(args.distances);
  const medAge = mediane(args.agesMois);
  const medPm2 = mediane(args.prixM2);
  const iqr =
    args.prixM2.length >= 4
      ? [...args.prixM2].sort((a, b) => a - b)[Math.floor(args.prixM2.length * 0.75)]! -
        [...args.prixM2].sort((a, b) => a - b)[Math.floor(args.prixM2.length * 0.25)]!
      : null;
  const disp = medPm2 && medPm2 > 0 && iqr != null ? iqr / medPm2 : 1;
  let score = Math.min(40, n * 5);
  if (medDist != null) score += medDist <= 300 ? 25 : medDist <= 600 ? 16 : medDist <= 1000 ? 8 : 2;
  if (medAge != null) score += medAge <= 18 ? 20 : medAge <= 36 ? 12 : 4;
  score += disp < 0.2 ? 15 : disp < 0.35 ? 8 : 0;
  score = Math.max(0, Math.min(100, score));
  if (n >= 8 && (medDist ?? 9999) <= 400 && (medAge ?? 99) <= 24 && disp < 0.25) {
    return { label: 'élevée', score };
  }
  if (n >= 5 && (medDist ?? 9999) <= 1000 && disp < 0.45) {
    return { label: 'moyenne', score };
  }
  return { label: 'faible', score };
}

export type LotPondere = {
  vente: VenteBrute;
  distanceM: number | null;
  sameBuilding: boolean;
  sameStreet: boolean;
  prixM2Actualise: number;
  poids: number;
};

export function assemblerEstimation(args: {
  input: MoteurInput;
  lot: LotPondere[];
  indice: IndiceLocal | null;
  radiusM: number;
  fenetreMois: number;
  exclues: VenteExclue[];
  maintenant?: Date;
}): MoteurResultat {
  const { input, lot, indice, radiusM, fenetreMois, exclues } = args;
  if (lot.length < MOTEUR_CONFIG.MIN_VENTES) {
    return {
      ...impossible(
        'pas_assez_comparables',
        `Seulement ${lot.length} vente${lot.length > 1 ? 's' : ''} comparable${lot.length > 1 ? 's' : ''} après nettoyage.`,
        'Élargissez la zone, vérifiez le type de bien, ou saisissez le prix à la main.',
      ),
      exclues,
      radiusM,
      fenetreMois,
      indice,
    };
  }

  const pente = penteSurface(lot.map((l) => ({ surfaceM2: l.vente.surfaceM2!, prixM2: l.prixM2Actualise })));
  const surfRef = mediane(lot.map((l) => l.vente.surfaceM2!)) ?? input.surfaceM2;
  const pm2Corriges = lot.map((l) => ({
    valeur: corrigerSurface(l.prixM2Actualise, input.surfaceM2, surfRef, pente),
    poids: l.poids,
  }));
  const pm2Ref = medianePonderee(pm2Corriges);
  if (pm2Ref == null || pm2Ref <= 0) {
    return {
      ...impossible(
        'valeur_incalculable',
        'Impossible de former un prix de référence à partir des ventes retenues.',
        'Saisissez le prix à la main.',
      ),
      exclues,
      radiusM,
      fenetreMois,
      indice,
    };
  }

  const base = pm2Ref * input.surfaceM2;
  const ajustements = ajustementsMoteur(input, base);
  const brut = base + ajustements.reduce((s, a) => s + a.amountEur, 0);
  const value = arrondirMillier(brut);
  if (value == null) {
    return {
      ...impossible(
        'valeur_incalculable',
        'La valeur calculée est nulle ou invalide.',
        'Saisissez le prix à la main.',
      ),
      exclues,
      radiusM,
      fenetreMois,
      indice,
      ajustements,
    };
  }

  const prixVentes = lot.map((l) => ({
    valeur: corrigerSurface(l.prixM2Actualise, input.surfaceM2, surfRef, pente) * input.surfaceM2
      + ajustements.reduce((s, a) => s + a.amountEur, 0),
    poids: l.poids,
  }));
  const { low, high } = fourchetteDepuisDispersion(prixVentes, value);

  const maintenant = args.maintenant ?? new Date();
  const fiab = scorerFiabilite({
    n: lot.length,
    distances: lot.map((l) => l.distanceM ?? radiusM),
    agesMois: lot.map((l) => {
      const ms = maintenant.getTime() - Date.parse(l.vente.dateMutation);
      return Number.isFinite(ms) ? ms / (30.44 * 24 * 3600 * 1000) : 24;
    }),
    prixM2: lot.map((l) => l.prixM2Actualise),
  });

  const retenues: VenteRetenue[] = lot
    .slice()
    .sort((a, b) => b.poids - a.poids)
    .map((l) => ({
      id: l.vente.id,
      idMutation: l.vente.idMutation,
      date: l.vente.dateMutation,
      surfaceM2: l.vente.surfaceM2!,
      prix: l.vente.valeurFonciere!,
      prixM2: prixM2De(l.vente)!,
      prixM2Actualise: Math.round(l.prixM2Actualise),
      poids: l.poids,
      distanceM: l.distanceM,
      sameBuilding: l.sameBuilding,
      sameStreet: l.sameStreet,
      voie: voieNormalisee(l.vente.adresse),
    }));

  return {
    available: true,
    value,
    low,
    high,
    pricePerM2: Math.round(value / input.surfaceM2),
    reliability: fiab.label,
    reliabilityScore: fiab.score,
    retenues,
    exclues,
    ajustements,
    indice,
    radiusM,
    fenetreMois,
    impossible: null,
  };
}

export function preparerLot(
  ventes: readonly VenteBrute[],
  input: MoteurInput,
  origine: { lat: number; lng: number; banId: string | null; parcelleId: string | null; voie: string | null },
  indice: IndiceLocal | null,
  maintenant = new Date(),
): LotPondere[] {
  const penteDispo = penteSurface(
    ventes
      .filter((v) => v.surfaceM2 != null && v.surfaceM2 > 0)
      .map((v) => ({ surfaceM2: v.surfaceM2!, prixM2: actualiserPrixM2(prixM2De(v)!, v.dateMutation, indice) })),
  );
  let pool = ventes;
  if (penteDispo == null) {
    const tol = MOTEUR_CONFIG.SURFACE_TOLERANCE;
    const filtrées = ventes.filter((v) => {
      if (v.surfaceM2 == null) return false;
      const r = v.surfaceM2 / input.surfaceM2;
      return r >= 1 - tol && r <= 1 + tol;
    });
    if (filtrées.length >= MOTEUR_CONFIG.MIN_VENTES) pool = filtrées;
  }

  return pool.map((v) => {
    const distanceM =
      v.lat != null && v.lng != null ? haversineM(origine.lat, origine.lng, v.lat, v.lng) : null;
    const sameBuilding =
      (origine.banId != null && v.banId === origine.banId) ||
      (origine.parcelleId != null && v.parcelleId === origine.parcelleId);
    const sameStreet =
      !sameBuilding &&
      origine.voie != null &&
      voieNormalisee(v.adresse) != null &&
      voieNormalisee(v.adresse) === origine.voie;
    const prixM2Actualise = actualiserPrixM2(prixM2De(v)!, v.dateMutation, indice);
    return {
      vente: v,
      distanceM,
      sameBuilding,
      sameStreet,
      prixM2Actualise,
      poids: poidsVente({
        distanceM,
        dateIso: v.dateMutation,
        surfaceM2: v.surfaceM2!,
        surfaceCible: input.surfaceM2,
        sameBuilding,
        sameStreet,
        maintenant,
      }),
    };
  });
}

/** Recalcule à partir d’un lot déjà nettoyé (retrait / rétablissement d’une vente). */
export function recalculerSelection(
  ventes: readonly VenteBrute[],
  input: MoteurInput,
  origine: { lat: number; lng: number; banId: string | null; parcelleId: string | null; voie: string | null },
  meta: { radiusM: number; fenetreMois: number; indice: IndiceLocal | null },
): MoteurResultat {
  const { candidates, exclues } = nettoyerVentes(ventes, input.propertyType, {
    exclusIds: input.exclusIds,
  });
  if (candidates.length === 0) {
    return {
      ...impossible(
        'aucune_vente_apres_nettoyage',
        'Toutes les ventes ont été écartées.',
        'Rétablissez des comparables, ou saisissez le prix à la main.',
      ),
      exclues,
      radiusM: meta.radiusM,
      fenetreMois: meta.fenetreMois,
      indice: meta.indice,
    };
  }
  const lot = preparerLot(candidates, input, origine, meta.indice);
  return assemblerEstimation({
    input,
    lot,
    indice: meta.indice,
    radiusM: meta.radiusM,
    fenetreMois: meta.fenetreMois,
    exclues,
  });
}
