import { baisseAvantSuivi, baisseCumulee, joursDepuis, joursEnLigne, libelleAdresse, prixDans } from '@/lib/annonces/presenter';
import type { Annonce, EvenementAnnonce } from '@/lib/annonces/types';
import type { DpeTournee } from '@/lib/tournee/generer';

/**
 * Le flash de la carte : ce qui vient de bouger dans le périmètre affiché.
 * Nouveaux DPE, annonces en baisse, nouvelles annonces. Module pur : la
 * lecture des données vit dans la route `/api/dashboard/flash`.
 */

/** Au-delà d'une semaine, ni un DPE, ni une baisse, ni une annonce n'est plus une nouvelle. */
export const FENETRE_FLASH_JOURS = 7;
const MAX_PAR_TYPE = 6;

export type TypeFlash = 'dpe' | 'baisse' | 'nouvelle';

type Lieu = {
  /** Adresse complète, code postal compris : la carte s'en sert pour trouver la parcelle. */
  adresse: string;
  /** Ce qu'on affiche : la rue seule. */
  rue: string;
  codePostal: string | null;
  latitude: number;
  longitude: number;
};

export type FlashDpe = Lieu & {
  id: string;
  type: 'dpe';
  /** YYYY-MM-DD, le plus récent de l'immeuble. */
  date: string;
  banId: string;
  lettre: string | null;
  surfaceM2: number | null;
  /** Plusieurs DPE dans le même immeuble : une seule nouvelle. */
  nombre: number;
};

export type FlashAnnonce = Lieu & {
  id: string;
  type: 'baisse' | 'nouvelle';
  date: string;
  annonce: Annonce;
  /** Baisse en pour cent, positive. */
  pourcent: number | null;
};

export type FlashItem = FlashDpe | FlashAnnonce;

export type LieuAJuger = {
  adresse: string;
  codePostal: string | null;
  latitude: number;
  longitude: number;
  parcelleId: string | null;
};

type Contexte = {
  dansLePerimetre: (lieu: LieuAJuger) => boolean;
  maintenant: Date;
};

/** « 12 Rue des Pyrénées 75020 Paris » → « 12 Rue des Pyrénées ». */
export function rueDe(adresse: string): string {
  return adresse.replace(/\s*,?\s*\d{5}\b.*$/, '').trim() || adresse.trim();
}

function recent(iso: string, maintenant: Date): boolean {
  const jours = joursDepuis(iso, maintenant);
  return jours !== null && jours >= 0 && jours <= FENETRE_FLASH_JOURS;
}

function plusRecentDabord<T extends { date: string }>(a: T, b: T): number {
  return b.date.localeCompare(a.date);
}

export function flashDesDpe(dpes: readonly DpeTournee[], ctx: Contexte): FlashDpe[] {
  const vus = new Set<string>();
  const parImmeuble = new Map<string, FlashDpe>();
  for (const dpe of dpes) {
    // L'ADEME et la copie en base rendent souvent le même diagnostic.
    const cle = dpe.numeroDpe ?? `${dpe.banId}|${dpe.date}|${dpe.surfaceM2 ?? ''}`;
    if (vus.has(cle)) continue;
    vus.add(cle);
    if (!recent(dpe.date, ctx.maintenant)) continue;
    if (
      !ctx.dansLePerimetre({
        adresse: dpe.adresse,
        codePostal: dpe.codePostal,
        latitude: dpe.latitude,
        longitude: dpe.longitude,
        parcelleId: dpe.parcelleId,
      })
    ) {
      continue;
    }
    const lettre = dpe.lettre?.trim().toUpperCase() || null;
    const deja = parImmeuble.get(dpe.banId);
    if (!deja) {
      parImmeuble.set(dpe.banId, {
        id: `dpe:${dpe.banId}`,
        type: 'dpe',
        date: dpe.date,
        banId: dpe.banId,
        adresse: dpe.adresse,
        rue: rueDe(dpe.adresse),
        codePostal: dpe.codePostal,
        latitude: dpe.latitude,
        longitude: dpe.longitude,
        lettre,
        surfaceM2: dpe.surfaceM2,
        nombre: 1,
      });
      continue;
    }
    deja.nombre += 1;
    if (dpe.date > deja.date) {
      deja.date = dpe.date;
      deja.lettre = lettre;
      deja.surfaceM2 = dpe.surfaceM2;
    }
  }
  return [...parImmeuble.values()].sort(plusRecentDabord).slice(0, MAX_PAR_TYPE);
}

/** La dernière baisse vraiment vue par Priimo, pas celle que le portail affichait déjà. */
function derniereBaisse(
  annonce: Annonce,
  evenements: readonly EvenementAnnonce[],
): { date: string; pourcent: number | null } | null {
  let meilleure: EvenementAnnonce | null = null;
  for (const evt of evenements) {
    if (evt.annonceId !== annonce.id || evt.type !== 'baisse_prix') continue;
    if (baisseAvantSuivi(evt, annonce.premiereVueLe)) continue;
    if (!meilleure || evt.survenuLe > meilleure.survenuLe) meilleure = evt;
  }
  if (!meilleure) return null;
  const avant = prixDans(meilleure.avant);
  const apres = prixDans(meilleure.apres);
  const pourcent =
    avant != null && apres != null && avant > 0 && apres < avant
      ? Math.round(((avant - apres) / avant) * 1000) / 10
      : baisseCumulee(annonce);
  return { date: meilleure.survenuLe, pourcent };
}

export function flashDesAnnonces(
  annonces: readonly Annonce[],
  evenements: readonly EvenementAnnonce[],
  ctx: Contexte,
): FlashAnnonce[] {
  const logements = new Set<string>();
  const baisses: FlashAnnonce[] = [];
  const nouvelles: FlashAnnonce[] = [];
  for (const annonce of annonces) {
    if (annonce.statut !== 'active' || annonce.latitude == null || annonce.longitude == null) continue;
    // Le même appartement sur PAP et SeLoger : une seule nouvelle.
    const logement = annonce.logementCle?.trim() || annonce.id;
    if (logements.has(logement)) continue;
    const rue = libelleAdresse(annonce).ligne;
    const adresse = [rue, annonce.codePostal, annonce.ville].filter(Boolean).join(' ');
    const lieu = {
      adresse,
      rue,
      codePostal: annonce.codePostal,
      latitude: annonce.latitude,
      longitude: annonce.longitude,
    };

    const baisse = derniereBaisse(annonce, evenements);
    const baisseRecente = baisse && recent(baisse.date, ctx.maintenant) ? baisse : null;
    const jours = joursEnLigne(annonce, ctx.maintenant);
    const misEnLigne = annonce.publieeLe ?? annonce.premiereVueLe;
    const nouvelle = jours != null && jours <= FENETRE_FLASH_JOURS && misEnLigne ? misEnLigne : null;
    // Le secteur se juge en dernier : c'est le test le plus cher, et la plupart des annonces n'ont rien de neuf.
    if (!baisseRecente && !nouvelle) continue;
    if (!ctx.dansLePerimetre({ ...lieu, parcelleId: annonce.parcelleIds[0] ?? null })) continue;

    logements.add(logement);
    if (baisseRecente) {
      baisses.push({
        id: `baisse:${annonce.id}`,
        type: 'baisse',
        date: baisseRecente.date,
        annonce,
        pourcent: baisseRecente.pourcent,
        ...lieu,
      });
    } else if (nouvelle) {
      nouvelles.push({ id: `nouvelle:${annonce.id}`, type: 'nouvelle', date: nouvelle, annonce, pourcent: null, ...lieu });
    }
  }
  return [
    ...baisses.sort(plusRecentDabord).slice(0, MAX_PAR_TYPE),
    ...nouvelles.sort(plusRecentDabord).slice(0, MAX_PAR_TYPE),
  ];
}

/**
 * L'ordre du bandeau : chacun son tour (un DPE, une baisse, une nouvelle…),
 * le plus récent d'abord dans chaque famille. Un bandeau qui enchaîne six DPE
 * avant la première annonce ressemble à une liste, pas à un fil d'info.
 */
export function ordreDuBandeau(items: readonly FlashItem[]): FlashItem[] {
  const familles: TypeFlash[] = ['dpe', 'baisse', 'nouvelle'];
  const files = familles.map((t) => items.filter((i) => i.type === t).sort(plusRecentDabord));
  const out: FlashItem[] = [];
  for (let rang = 0; files.some((f) => rang < f.length); rang++) {
    for (const file of files) {
      const item = file[rang];
      if (item) out.push(item);
    }
  }
  return out;
}

/** « aujourd'hui », « hier », « il y a 3 j ». */
export function quandFlash(iso: string, maintenant = new Date()): string {
  const jours = joursDepuis(iso, maintenant);
  if (jours === null || jours <= 0) return 'aujourd’hui';
  if (jours === 1) return 'hier';
  return `il y a ${jours} j`;
}
