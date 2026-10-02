/**
 * Cartes calculées sur le téléphone, sans attendre le modèle : un prix, une
 * surface, un T3, un téléphone, une adresse, « rappeler Untel jeudi »
 * apparaissent au mot près. La lecture par le modèle (≈ 3 s) les remplace
 * ensuite par des cartes complètes.
 */

import { extractEstimationHeuristic } from '@/lib/estimation/voice-heuristic';
import { extraireTelephones, guessAdresseFromTranscript } from '@/lib/notes/from-transcript';
import { resoudreQuand } from '@/lib/notes/date-relative';
import { heureLisible, jourLisible, type CarteComprise } from '@/lib/voice/cartes';

const MONTANT =
  /(\d{1,3}(?:[\s. ]\d{3})+|\d+(?:[.,]\d+)?)\s*(k\s*€?|mille\s*euros?|millions?\s*(?:d'?euros)?|euros?|€)/gi;

function euros(n: number): string {
  return `${new Intl.NumberFormat('fr-FR').format(n)} €`;
}

/** Le dernier montant dit (« 450 000 euros », « 300 k », « 1,2 million »). */
export function dernierMontant(texte: string): number | null {
  let dernier: number | null = null;
  for (const m of texte.matchAll(MONTANT)) {
    const brut = Number(m[1]!.replace(/[\s. ]/g, '').replace(',', '.'));
    if (!Number.isFinite(brut)) continue;
    const unite = m[2]!.toLowerCase();
    const valeur = unite.startsWith('k') || unite.startsWith('mille')
      ? brut * 1000
      : unite.startsWith('million')
        ? brut * 1_000_000
        : brut;
    if (valeur >= 1000) dernier = Math.round(valeur);
  }
  return dernier;
}

const RAPPEL =
  /\b(rappeler|relancer|recontacter|rappelle|relance)\s+((?:m(?:adame|onsieur|me|\.)?\s+)?[A-ZÀ-Ý][\p{L}'-]+(?:\s+[A-ZÀ-Ý][\p{L}'-]+)?)([^.!?]{0,40})/u;
const CIVILITE = /\b(?:madame|monsieur|mme|m\.)\s+([A-ZÀ-Ý][\p{L}'-]+(?:\s+[A-ZÀ-Ý][\p{L}'-]+)?)/gu;

export function cartesLocales(texte: string, maintenant = new Date()): CarteComprise[] {
  const t = texte.trim();
  if (t.length < 6) return [];
  const cartes: CarteComprise[] = [];

  for (const m of t.matchAll(CIVILITE)) {
    const nom = m[0]!.replace(/\s+/g, ' ');
    if (!cartes.some((c) => c.titre === nom)) {
      cartes.push({ key: `local:personne:${nom}`, kind: 'personne', titre: nom, detail: null, badge: null });
    }
  }
  for (const tel of extraireTelephones(t).slice(0, 2)) {
    cartes.push({ key: `local:tel:${tel}`, kind: 'personne', titre: tel, detail: 'Téléphone', badge: null });
  }

  const rappel = t.match(RAPPEL);
  if (rappel) {
    const qui = rappel[2]!.trim();
    const quand = resoudreQuand(rappel[3] ?? '', maintenant);
    cartes.push({
      key: `local:rappel:${qui}`,
      kind: 'rappel',
      titre: `Rappeler ${qui}`,
      detail: quand
        ? `${jourLisible(quand.date, maintenant)}${quand.heure ? ` à ${heureLisible(quand.heure)}` : ''}`
        : null,
      badge: null,
    });
  }

  const bien = extractEstimationHeuristic(t);
  const montant = dernierMontant(t);
  const caracteristiques = [
    bien.rooms ? (bien.rooms <= 7 ? `T${bien.rooms}` : `${bien.rooms} pièces`) : null,
    bien.surfaceM2 ? `${bien.surfaceM2} m²` : null,
    montant ? euros(montant) : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const adresse = guessAdresseFromTranscript(t);
  if (adresse || caracteristiques) {
    cartes.push({
      key: 'local:lieu',
      kind: caracteristiques ? 'bien' : 'lieu',
      titre: adresse ?? caracteristiques,
      detail: adresse ? caracteristiques || null : null,
      badge: null,
    });
  }
  return cartes;
}

/**
 * Ce que montre l'écran : les cartes du modèle, plus les cartes locales d'un
 * genre qu'il n'a pas encore vu (ce qui vient d'être dit depuis sa dernière
 * lecture).
 */
export function fusionnerCartes(modele: readonly CarteComprise[], locales: readonly CarteComprise[]): CarteComprise[] {
  const genres = new Set(modele.map((c) => (c.kind === 'lieu' ? 'bien' : c.kind)));
  return [
    ...modele,
    ...locales.filter((c) => !genres.has(c.kind === 'lieu' ? 'bien' : c.kind)),
  ];
}
