import type { DispositionPageAgence } from '@/types/database';
import {
  corpsEstVide,
  normaliserCorps,
  texteBrutCorps,
  type CorpsTexte,
} from '@/lib/rapport/texte-riche';

export const DISPOSITIONS_PAGE: DispositionPageAgence[] = ['texte', 'texte_image', 'image', 'points'];

export const LIBELLE_DISPOSITION: Record<DispositionPageAgence, string> = {
  texte: 'Texte',
  texte_image: 'Texte et image',
  image: 'Image pleine page',
  points: 'Points clés',
};

export const DESC_DISPOSITION: Record<DispositionPageAgence, string> = {
  texte: 'Titre et texte. Méthode, conditions, explications.',
  texte_image: 'Titre, texte et image à gauche ou à droite.',
  image: 'Visuel occupé toute la page, titre optionnel.',
  points: 'Titre et trois à six engagements ou services.',
};

export const MAX_POINTS_CLES = 6;
export const MIN_POINTS_CLES = 3;

export type CoteImage = 'gauche' | 'droite';

export type PointCle = {
  intitule: string;
  description: string;
};

export type ContenuPageModele = {
  titre?: string;
  corps?: CorpsTexte;
  imageCote?: CoteImage;
  points?: PointCle[];
};

export type PointCleVisible = {
  intitule: string | null;
  description: string | null;
};

export type VisuelPageModele = {
  titre: string | null;
  corps: CorpsTexte;
  imageCote: CoteImage;
  points: PointCleVisible[];
};

function trimOuNul(raw: string | null | undefined): string | null {
  const s = raw?.replace(/\s+/g, ' ').trim() ?? '';
  return s || null;
}

export function estDisposition(value: unknown): value is DispositionPageAgence {
  return typeof value === 'string' && (DISPOSITIONS_PAGE as string[]).includes(value);
}

export function normaliserCoteImage(raw: unknown): CoteImage {
  return raw === 'gauche' ? 'gauche' : 'droite';
}

export function normaliserPoints(raw: unknown): PointCle[] {
  if (!Array.isArray(raw)) return [];
  const out: PointCle[] = [];
  for (const item of raw) {
    if (out.length >= MAX_POINTS_CLES) break;
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    out.push({
      intitule: typeof rec.intitule === 'string' ? rec.intitule : '',
      description: typeof rec.description === 'string' ? rec.description : '',
    });
  }
  return out;
}

export function contenuDepuisJson(raw: unknown): ContenuPageModele {
  if (typeof raw === 'string') {
    try {
      return normaliserContenu(JSON.parse(raw) as unknown);
    } catch {
      return {};
    }
  }
  return normaliserContenu(raw);
}

export function normaliserContenu(raw: unknown): ContenuPageModele {
  if (!raw || typeof raw !== 'object') return {};
  const rec = raw as Record<string, unknown>;
  const contenu: ContenuPageModele = {};
  const titre = trimOuNul(typeof rec.titre === 'string' ? rec.titre : null);
  if (titre) contenu.titre = titre.slice(0, 120);
  const corps = normaliserCorps(rec.corps);
  if (!corpsEstVide(corps)) contenu.corps = corps;
  if (rec.imageCote === 'gauche' || rec.imageCote === 'droite') contenu.imageCote = rec.imageCote;
  const points = normaliserPoints(rec.points);
  if (points.length > 0) contenu.points = points;
  return contenu;
}

export function pointVisible(point: PointCle): PointCleVisible | null {
  const intitule = trimOuNul(point.intitule);
  const description = trimOuNul(point.description);
  if (!intitule && !description) return null;
  return { intitule, description };
}

/** Champs vides absents : aucun libellé orphelin, aucun bloc vide. */
export function visuelPage(contenu: ContenuPageModele): VisuelPageModele {
  return {
    titre: trimOuNul(contenu.titre),
    corps: contenu.corps && !corpsEstVide(contenu.corps) ? contenu.corps : [],
    imageCote: normaliserCoteImage(contenu.imageCote),
    points: (contenu.points ?? []).map(pointVisible).filter((p): p is PointCleVisible => p !== null),
  };
}

export function nomDepuisContenu(contenu: ContenuPageModele, disposition: DispositionPageAgence): string {
  const titre = trimOuNul(contenu.titre);
  if (titre) return titre.slice(0, 80);
  const brut = contenu.corps ? texteBrutCorps(contenu.corps) : '';
  if (brut) return brut.slice(0, 80);
  const premier = (contenu.points ?? []).map(pointVisible).find(Boolean);
  if (premier?.intitule) return premier.intitule.slice(0, 80);
  return LIBELLE_DISPOSITION[disposition];
}

export function libelleKindPage(
  kind: 'pdf' | 'image' | 'modele' | 'generee',
  disposition?: DispositionPageAgence | null,
  pageCount = 1,
): string {
  if (kind === 'modele' && disposition) return LIBELLE_DISPOSITION[disposition];
  if (kind === 'pdf') return pageCount > 1 ? `PDF · ${pageCount} pages` : 'PDF';
  if (kind === 'image') return 'Image';
  if (kind === 'generee') return 'Page générée';
  return 'Page';
}
