/**
 * L'annonce d'où vient une carte du pipeline. La carte garde l'adresse et la
 * fiche bien (prix, surface, pièces), pas l'identifiant de l'annonce : on la
 * retrouve par l'adresse, puis par le prix, la surface et les pièces quand
 * plusieurs annonces partagent l'immeuble. Pur.
 */
import type { Lead } from '@/types/lead';
import type { Annonce } from './types';

function normaliser(texte: string | null | undefined): string {
  return (texte ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** « 25 Rue du Surmelin » : la rue d'une annonce, sans code postal ni ville. */
function rueDeLAnnonce(a: Annonce): string {
  if (a.adresseNumero && a.adresseVoie) return normaliser(`${a.adresseNumero} ${a.adresseVoie}`);
  return normaliser((a.adresse ?? '').replace(/\s\d{5}\b.*$/, ''));
}

function memeRue(rueLead: string, rueAnnonce: string): boolean {
  if (!rueLead || !rueAnnonce) return false;
  return rueLead === rueAnnonce || rueLead.startsWith(`${rueAnnonce} `) || rueAnnonce.startsWith(`${rueLead} `);
}

type CarteDuPipeline = Pick<Lead, 'address' | 'postalCode' | 'surfaceM2' | 'rooms' | 'bien'>;

function score(lead: CarteDuPipeline, a: Annonce): number {
  let s = a.statut === 'active' ? 0.5 : 0;
  const prix = lead.bien?.price ?? null;
  if (prix != null && (prix === a.prix || prix === a.prixInitial)) s += 3;
  if (lead.surfaceM2 != null && a.surface != null && Math.abs(lead.surfaceM2 - a.surface) < 1) s += 2;
  if (lead.rooms != null && a.pieces != null && lead.rooms === a.pieces) s += 1;
  return s;
}

export function annonceDuLead(
  lead: CarteDuPipeline,
  annonces: readonly Annonce[],
): { annonce: Annonce; soeurs: Annonce[] } | null {
  const rue = normaliser(lead.address);
  if (!rue) return null;
  const candidates = annonces.filter(
    (a) =>
      memeRue(rue, rueDeLAnnonce(a)) &&
      (!lead.postalCode || !a.codePostal || lead.postalCode === a.codePostal),
  );
  if (candidates.length === 0) return null;
  const meilleure = [...candidates].sort(
    (x, y) =>
      score(lead, y) - score(lead, x) || String(y.derniereVueLe ?? '').localeCompare(String(x.derniereVueLe ?? '')),
  )[0]!;
  const soeurs = meilleure.logementCle
    ? annonces.filter((a) => a.logementCle === meilleure.logementCle)
    : [meilleure];
  return { annonce: meilleure, soeurs: soeurs.length > 0 ? soeurs : [meilleure] };
}
