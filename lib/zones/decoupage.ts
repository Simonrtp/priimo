import { COULEURS_ZONE } from './palette';
import type { ValeurPolygone } from './types';

/**
 * Proposition de découpage — personne ne part d'une page blanche.
 *
 * Un découpage à vue de nez donne toujours une zone riche et une zone pauvre,
 * et c'est une source directe de conflit d'équipe. On coupe donc sur les leads
 * réellement livrés : chaque secteur en reçoit autant que les autres.
 *
 * La méthode : couper récursivement le nuage de points par sa médiane, sur
 * l'axe le plus étalé. Les cellules obtenues pavent exactement l'emprise des
 * leads — ni trou, ni recouvrement — et restent des polygones qu'on retouche
 * ensuite. Ce n'est pas un résultat figé, c'est un point de départ.
 */

export type PointLead = { latitude: number; longitude: number };

export type ZoneProposee = {
  nom: string;
  couleur: string;
  polygone: ValeurPolygone;
  nbLeads: number;
};

type Cellule = { ouest: number; sud: number; est: number; nord: number };

/** Marge autour de l'emprise : un lead pile sur le bord doit tomber dedans. */
const MARGE_DEG = 0.0015;

function emprise(points: readonly PointLead[]): Cellule | null {
  if (points.length === 0) return null;
  let ouest = Infinity;
  let sud = Infinity;
  let est = -Infinity;
  let nord = -Infinity;
  for (const p of points) {
    if (p.longitude < ouest) ouest = p.longitude;
    if (p.longitude > est) est = p.longitude;
    if (p.latitude < sud) sud = p.latitude;
    if (p.latitude > nord) nord = p.latitude;
  }
  return {
    ouest: ouest - MARGE_DEG,
    sud: sud - MARGE_DEG,
    est: est + MARGE_DEG,
    nord: nord + MARGE_DEG,
  };
}

function versPolygone(c: Cellule): ValeurPolygone {
  return {
    type: 'Polygon',
    coordinates: [
      [
        [c.ouest, c.sud],
        [c.est, c.sud],
        [c.est, c.nord],
        [c.ouest, c.nord],
        [c.ouest, c.sud],
      ],
    ],
  };
}

type Groupe = { cellule: Cellule; points: PointLead[] };

/**
 * Coupe un groupe en deux parts dont les effectifs suivent `partGauche`.
 * On coupe l'axe le plus étalé : découper une bande étroite dans sa longueur
 * donnerait des secteurs impraticables à pied.
 */
function couper(groupe: Groupe, partGauche: number): [Groupe, Groupe] {
  const { cellule, points } = groupe;
  // Un degré de latitude vaut ~1,4 fois un degré de longitude à Paris : sans
  // ce facteur, on couperait toujours dans le même sens.
  const largeur = (cellule.est - cellule.ouest) * Math.cos((cellule.sud * Math.PI) / 180);
  const hauteur = cellule.nord - cellule.sud;
  const selonLongitude = largeur >= hauteur;

  const tries = [...points].sort((a, b) =>
    selonLongitude ? a.longitude - b.longitude : a.latitude - b.latitude,
  );
  const coupe = Math.max(1, Math.min(tries.length - 1, Math.round(partGauche)));
  const gauche = tries.slice(0, coupe);
  const droite = tries.slice(coupe);

  // La frontière passe entre les deux points de part et d'autre de la coupe.
  const dernierGauche = gauche[gauche.length - 1]!;
  const premierDroite = droite[0]!;
  const frontiere = selonLongitude
    ? (dernierGauche.longitude + premierDroite.longitude) / 2
    : (dernierGauche.latitude + premierDroite.latitude) / 2;

  const celluleGauche = selonLongitude
    ? { ...cellule, est: frontiere }
    : { ...cellule, nord: frontiere };
  const celluleDroite = selonLongitude
    ? { ...cellule, ouest: frontiere }
    : { ...cellule, sud: frontiere };

  return [
    { cellule: celluleGauche, points: gauche },
    { cellule: celluleDroite, points: droite },
  ];
}

function decouper(groupe: Groupe, n: number): Groupe[] {
  if (n <= 1 || groupe.points.length < 2) return [groupe];
  const nGauche = Math.ceil(n / 2);
  const nDroite = n - nGauche;
  const cible = (groupe.points.length * nGauche) / n;
  const [gauche, droite] = couper(groupe, cible);
  return [...decouper(gauche, nGauche), ...decouper(droite, nDroite)];
}

/**
 * `n` secteurs équilibrés sur les leads fournis — à l'appelant de ne passer
 * que les trois derniers mois. Les leads sans coordonnées sont ignorés : on ne
 * découpe pas un territoire sur des adresses qu'on ne sait pas placer.
 */
export function proposerDecoupage(
  leads: readonly { latitude: number | null; longitude: number | null }[],
  n: number,
  nomsExistants: readonly string[] = [],
): ZoneProposee[] {
  const points: PointLead[] = [];
  for (const l of leads) {
    if (l.latitude === null || l.longitude === null) continue;
    if (!Number.isFinite(l.latitude) || !Number.isFinite(l.longitude)) continue;
    points.push({ latitude: l.latitude, longitude: l.longitude });
  }

  const depart = emprise(points);
  const voulues = Math.max(1, Math.floor(n));
  if (!depart || points.length === 0) return [];

  const groupes = decouper({ cellule: depart, points }, voulues);
  const pris = new Set(nomsExistants.map((x) => x.trim().toLowerCase()));

  return groupes.map((groupe, i) => {
    let nom = `Secteur ${i + 1}`;
    let suffixe = 2;
    while (pris.has(nom.toLowerCase())) {
      nom = `Secteur ${i + 1} (${suffixe})`;
      suffixe += 1;
    }
    pris.add(nom.toLowerCase());
    return {
      nom,
      couleur: COULEURS_ZONE[i % COULEURS_ZONE.length]!,
      polygone: versPolygone(groupe.cellule),
      nbLeads: groupe.points.length,
    };
  });
}

/** Fenêtre de référence du découpage : les trois derniers mois de livraison. */
export function depuisTroisMois<T extends { deliveredAt?: string | null; createdAt: string }>(
  leads: readonly T[],
  maintenant: Date = new Date(),
): T[] {
  const seuil = new Date(maintenant);
  seuil.setMonth(seuil.getMonth() - 3);
  return leads.filter((l) => {
    const t = Date.parse(l.deliveredAt ?? l.createdAt);
    return Number.isFinite(t) && t >= seuil.getTime();
  });
}
