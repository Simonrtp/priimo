/**
 * Essai de bout en bout de la lecture d'une dictée, sans base :
 *   npx tsx scripts/essai-dictee.ts "texte dicté" [rapide|profond]
 *
 * Lit MISTRAL_API_KEY dans .env.local, passe le texte dans l'extraction v2,
 * construit la revue avec un petit contexte d'agence fictif et affiche les
 * cartes « Priimo a compris ». Sert à régler la consigne sur de vraies phrases.
 */

import { readFileSync } from 'node:fs';
import { extractNotePropositions } from '@/lib/notes/propositions';
import { buildReviewPayload } from '@/lib/notes/build-review';
import { cartesDepuisReview } from '@/lib/voice/cartes';
import type { Contact } from '@/types/contact';

const texte = process.argv[2];
const mode = process.argv[3] === 'rapide' ? 'rapide' : 'profond';
if (!texte) {
  console.error('Usage : npx tsx scripts/essai-dictee.ts "texte dicté" [rapide|profond]');
  process.exit(1);
}

const cle =
  process.env.MISTRAL_API_KEY ??
  readFileSync('.env.local', 'utf8').match(/^MISTRAL_API_KEY=(.*)$/m)?.[1]?.trim().replace(/^["']|["']$/g, '');
if (!cle) throw new Error('MISTRAL_API_KEY absente');

const agence = 'agence-essai';
const janine = {
  id: 'c-janine',
  agencyId: agence,
  firstName: 'Janine',
  lastName: 'Martin',
  fullName: 'Janine Martin',
  phone: '06 12 34 56 78',
  email: 'janine.martin@exemple.fr',
  address: null,
  banId: null,
} as unknown as Contact;

async function main() {
  const noteDate = new Date('2026-09-30T10:00:00Z');
  const debut = Date.now();
  const extraction = await extractNotePropositions(texte, cle, noteDate, { mode, agentPrenom: 'Simon' });
  const duree = Date.now() - debut;

  const review = buildReviewPayload({
    voiceNoteId: 'essai',
    transcript: texte,
    visibilite: 'agence',
    extraction,
    extractFailed: false,
    contacts: [janine],
    agencyId: agence,
    geo: { ban_id: null, adresse_normalisee: null, geocode_score: null },
    biensAgence: [
      { id: 'b-lilas', address: '12 rue des Lilas', city: 'Nantes', postalCode: '44000', price: 480000, surfaceM2: 72, rooms: 3, mandatStatut: 'mandat_simple' },
      { id: 'b-royale', address: '4 place Royale', city: 'Nantes', postalCode: '44000', price: 250000, surfaceM2: 42, rooms: 2, mandatStatut: 'mandat_exclusif' },
    ],
    noteDate,
  });

  console.log(`\nLecture ${mode} en ${duree} ms — « ${review.titre ?? 'sans titre'} »`);
  if (review.resume) console.log(`  ${review.resume}`);
  console.log('\nCartes :');
  for (const c of cartesDepuisReview(review, noteDate)) {
    console.log(`  [${c.kind}] ${c.titre}${c.detail ? ` — ${c.detail}` : ''}${c.badge ? `  (${c.badge})` : ''}`);
  }
  if (review.email) {
    console.log(`\nE-mail — destinataire dit : ${extraction.email?.personne ?? 'aucun'}`);
    console.log(`« ${review.email.objet} »\n${review.email.corps}`);
  }
}

void main();
