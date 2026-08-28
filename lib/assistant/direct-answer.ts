/**
 * Sauter la reformulation quand elle n'apporte rien.
 *
 * Une question factuelle qui ramène cinq lignes ou moins se lit très bien
 * mise en forme telle quelle : le deuxième appel de modèle ne ferait que
 * réécrire ce qui est déjà lisible. Cela supprime la moitié des appels.
 */

import type { CollecteAgregats, CollecteLigne, CollecteResult } from './collecte';
import type { IntentType } from './intent';

export const DIRECT_MAX_LIGNES = 5;

/** Types dont la réponse est une liste de faits, pas un raisonnement. */
const FACTUELS: ReadonlySet<IntentType> = new Set<IntentType>([
  'immeuble',
  'personne',
  'recherche_acquereur',
  'activite',
]);

export function peutRepondreDirect(collecte: CollecteResult): boolean {
  if (!FACTUELS.has(collecte.type)) return false;
  if (collecte.lignes.length === 0) return false;
  if (collecte.lignes.length > DIRECT_MAX_LIGNES) return false;
  return true;
}

const LIBELLE_KIND: Record<string, string> = {
  lead: 'Prospect',
  contact: 'Contact',
  bien: 'Bien',
  note: 'Note',
  interaction: 'Échange',
};

const LIBELLE_FAIT: Record<string, string> = {
  adresse: 'Adresse',
  nom: 'Nom',
  telephone: 'Téléphone',
  email: 'E-mail',
  statut: 'Statut',
  score: 'Score',
  type: 'Type',
  ville: 'Ville',
  code_postal: 'Code postal',
  surface_m2: 'Surface',
  prix: 'Prix',
  mandat: 'Mandat',
  assigne_a: 'Assigné à',
  texte: 'Texte',
};

function formatDateFr(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short' }).format(d);
}

function libelle(key: string): string {
  return LIBELLE_FAIT[key] ?? key.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

function valeur(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null;
  if (Array.isArray(v)) return v.length > 0 ? v.map(String).join(', ') : null;
  if (typeof v === 'boolean') return v ? 'oui' : 'non';
  return String(v);
}

function ligneTexte(ligne: CollecteLigne): string {
  const tete = [LIBELLE_KIND[ligne.kind] ?? ligne.kind, formatDateFr(ligne.date), ligne.auteur]
    .filter(Boolean)
    .join(' · ');
  const faits: string[] = [];
  for (const [key, raw] of Object.entries(ligne.faits)) {
    const v = valeur(raw);
    if (v === null) continue;
    faits.push(`${libelle(key)} : ${v}`);
  }
  return faits.length > 0 ? `${tete}\n${faits.join('\n')}` : tete;
}

function agregatsTexte(a: CollecteAgregats): string {
  const jours = a.periode_jours === 1 ? 'Aujourd’hui' : `Sur ${a.periode_jours} jours`;
  return [
    `${jours} :`,
    `Contacts créés : ${a.contacts_crees}`,
    `Échanges : ${a.echanges}`,
    `Notes vocales : ${a.notes_vocales}`,
    `Biens créés : ${a.biens_crees}`,
    `Prospects détectés : ${a.leads_detectes}`,
  ].join('\n');
}

/**
 * Mise en forme sans modèle. Chaque ligne affichée vient de la base : rien
 * n'est ajouté, rien n'est déduit.
 */
export function reponseDirecte(collecte: CollecteResult): string {
  const parts: string[] = [];
  if (collecte.rechercheParTexte) {
    parts.push("Recherche effectuée sur le texte de l'adresse, pas sur l'identifiant d'immeuble.");
  }
  if (collecte.agregats) parts.push(agregatsTexte(collecte.agregats));
  for (const ligne of collecte.lignes) parts.push(ligneTexte(ligne));
  return parts.join('\n\n');
}
