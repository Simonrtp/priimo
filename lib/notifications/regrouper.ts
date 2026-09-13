import { corpsGroupe, titreGroupe } from './textes';
import { FENETRE_GROUPE_MS, type Notification } from './types';

export type GroupeNotification = {
  /** Plus récente du groupe — sert de clé de ligne. */
  id: string;
  type: Notification['type'];
  titre: string;
  corps: string;
  lien: string;
  createdAt: string;
  lue: boolean;
  nonLues: number;
  groupeCle: string | null;
  items: Notification[];
};

function versGroupe(items: Notification[]): GroupeNotification {
  const [tete] = items;
  if (!tete) {
    throw new Error('groupe vide');
  }
  const n = items.length;
  const nonLues = items.filter((i) => !i.lueLe).length;
  return {
    id: tete.id,
    type: tete.type,
    titre: titreGroupe(tete.type, n, tete.titre),
    corps: corpsGroupe(tete.type, n, tete.corps),
    lien: tete.lien,
    createdAt: tete.createdAt,
    lue: nonLues === 0,
    nonLues,
    groupeCle: tete.groupeCle,
    items,
  };
}

/**
 * Une clé + une fenêtre de 2 h = une ligne. On part de la plus récente :
 * tout ce qui porte la même clé et tombe dans les deux heures précédentes
 * la rejoint. Sans ça, dix dictées font dix lignes.
 */
export function regrouperNotifications(items: readonly Notification[]): GroupeNotification[] {
  const tries = [...items].sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
  );
  const pris = new Set<string>();
  const groupes: GroupeNotification[] = [];

  for (const item of tries) {
    if (pris.has(item.id)) continue;
    const cluster: Notification[] = [item];
    pris.add(item.id);

    const cle = item.groupeCle?.trim() || null;
    if (cle) {
      const t0 = Date.parse(item.createdAt);
      for (const autre of tries) {
        if (pris.has(autre.id)) continue;
        if ((autre.groupeCle?.trim() || null) !== cle) continue;
        const t = Date.parse(autre.createdAt);
        if (!Number.isFinite(t) || !Number.isFinite(t0)) continue;
        if (t0 - t <= FENETRE_GROUPE_MS && t0 - t >= 0) {
          cluster.push(autre);
          pris.add(autre.id);
        }
      }
    }

    groupes.push(versGroupe(cluster));
  }

  return groupes;
}
