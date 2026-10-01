/**
 * Les cartes « Priimo a compris » qui apparaissent pendant la dictée.
 *
 * Une carte par chose comprise, avec une clé stable : quand la lecture repasse
 * et reformule, la carte se met à jour sur place au lieu de clignoter.
 */

import type { NoteReviewPayload } from '@/lib/notes/build-review';
import { CONTACT_TYPE_LABELS } from '@/types/contact';
import { normalizeName } from '@/lib/import/normalize';
import { libelleMiseAJour, lignesRecherche } from '@/lib/notes/review-v2';

export type CarteKind =
  | 'personne'
  | 'rappel'
  | 'tache'
  | 'rdv'
  | 'visite'
  | 'lieu'
  | 'bien'
  | 'mise_a_jour'
  | 'recherche'
  | 'prospect'
  | 'email'
  | 'question';

export type CarteComprise = {
  key: string;
  kind: CarteKind;
  titre: string;
  detail: string | null;
  /** Mise en avant discrète : « déjà dans vos contacts », « 3 biens ». */
  badge: string | null;
};

const JOUR = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'short',
  timeZone: 'Europe/Paris',
});

/** « AAAA-MM-JJ » → « aujourd'hui », « demain », « jeudi 2 oct. ». */
export function jourLisible(date: string, maintenant = new Date()): string {
  const [y, m, d] = date.split('-').map(Number);
  const cible = Date.UTC(y!, m! - 1, d!);
  const parisAujourdhui = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(maintenant);
  const [ya, ma, da] = parisAujourdhui.split('-').map(Number);
  const ecart = Math.round((cible - Date.UTC(ya!, ma! - 1, da!)) / 86_400_000);
  if (ecart === 0) return 'aujourd’hui';
  if (ecart === 1) return 'demain';
  if (ecart === -1) return 'hier';
  return JOUR.format(new Date(Date.UTC(y!, m! - 1, d!, 12)));
}

/** « 14:00 » → « 14h », « 09:30 » → « 9h30 ». */
export function heureLisible(heure: string): string {
  const [h, m] = heure.split(':');
  return `${Number(h)}h${m && m !== '00' ? m : ''}`;
}

function cle(...parts: (string | null | undefined)[]): string {
  return parts.map((p) => normalizeName(p ?? '')).join('|');
}

function euros(n: number): string {
  return `${new Intl.NumberFormat('fr-FR').format(n)} €`;
}

export function cartesDepuisReview(review: NoteReviewPayload | null, maintenant = new Date()): CarteComprise[] {
  if (!review) return [];
  const cartes: CarteComprise[] = [];

  if (review.intention === 'question') {
    cartes.push({
      key: 'question',
      kind: 'question',
      titre: 'C’est une question',
      detail: 'Mon assistant peut y répondre',
      badge: null,
    });
  }

  for (const p of review.personnes) {
    const match = p.matches[0];
    const nom =
      match?.label ||
      [p.personne.firstName, p.personne.lastName].filter(Boolean).join(' ') ||
      p.personne.phone;
    if (!nom) continue;
    const type = p.personne.type !== 'autre' ? CONTACT_TYPE_LABELS[p.personne.type] : null;
    cartes.push({
      key: `personne:${match?.contactId ?? cle(p.personne.lastName || p.personne.firstName)}`,
      kind: 'personne',
      titre: nom,
      detail: [type, p.personne.phone].filter(Boolean).join(' · ') || null,
      badge: match ? 'Déjà dans vos contacts' : 'Nouveau contact',
    });
  }

  for (const a of review.actions) {
    const quand = `${jourLisible(a.date, maintenant)}${a.heure ? ` à ${heureLisible(a.heure)}` : ''}`;
    const kind: CarteKind =
      a.type === 'rdv' ? 'rdv' : a.type === 'visite_faite' ? 'visite' : a.type === 'rappel' ? 'rappel' : 'tache';
    cartes.push({
      key: `action:${a.type}:${cle(a.intitule).slice(0, 40)}`,
      kind,
      titre: a.intitule,
      detail: a.type === 'visite_faite' ? 'Visite effectuée' : a.dateDeduite ? `${quand} · à confirmer` : quand,
      badge: a.type === 'rdv' || a.type === 'visite_faite' ? null : 'Sur votre accueil',
    });
  }

  const caracteristiques = [
    review.rooms ? (review.rooms <= 7 ? `T${review.rooms}` : `${review.rooms} pièces`) : null,
    review.surface ? `${review.surface} m²` : null,
    review.prix ? euros(review.prix) : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const adresse =
    review.immeuble?.adresseNormalisee ?? review.immeuble?.address ?? review.secteur ?? null;
  if (adresse || caracteristiques) {
    cartes.push({
      key: 'lieu',
      kind: caracteristiques ? 'bien' : 'lieu',
      titre: adresse ?? caracteristiques,
      detail: adresse ? caracteristiques || null : null,
      badge: review.leads.length > 0 ? 'Prospect DPE ici' : null,
    });
  }

  for (const m of review.misesAJour) {
    const l = libelleMiseAJour(m);
    cartes.push({
      key: `maj:${m.bienId}:${m.champ}`,
      kind: 'mise_a_jour',
      titre: `${l.quoi} : ${l.avant} → ${l.apres}`,
      detail: m.bienLabel,
      badge: null,
    });
  }

  if (review.recherche) {
    const n = review.recherche.correspondances.length;
    cartes.push({
      key: 'recherche',
      kind: 'recherche',
      titre: 'Recherche acquéreur',
      detail: lignesRecherche(review.recherche).join(' · ') || null,
      badge: n > 0 ? `${n} bien${n > 1 ? 's' : ''} correspond${n > 1 ? 'ent' : ''}` : null,
    });
  }

  if (review.prospect) {
    cartes.push({
      key: 'prospect',
      kind: 'prospect',
      titre: `Prospect → ${review.prospect.stageLibelle}`,
      detail: [review.prospect.adresse, review.prospect.motif].filter(Boolean).join(' · '),
      badge: null,
    });
  }

  if (review.email) {
    cartes.push({
      key: 'email',
      kind: 'email',
      titre: review.email.destinataire ? `E-mail à ${review.email.destinataire}` : 'E-mail à envoyer',
      detail: review.email.objet,
      badge: 'Brouillon prêt',
    });
  }

  return cartes;
}
