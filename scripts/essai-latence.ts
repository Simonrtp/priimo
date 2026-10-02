/**
 * Mesure la latence de lecture d'une dictée, modèle par modèle :
 *   npx tsx scripts/essai-latence.ts
 * Lit MISTRAL_API_KEY dans .env.local. Sert à choisir l'ordre des modèles.
 */

import { readFileSync } from 'node:fs';
import { extractNotePropositions } from '@/lib/notes/propositions';

const cle =
  process.env.MISTRAL_API_KEY ??
  readFileSync('.env.local', 'utf8').match(/^MISTRAL_API_KEY=(.*)$/m)?.[1]?.trim().replace(/^["']|["']$/g, '');

const TEXTE =
  "Je sors de chez Madame Janine Martin, au 12 rue des Lilas à Nantes. Elle vend son T3 de 72 mètres carrés, elle en veut 450 000 euros. Il faut la rappeler jeudi à 14h. J'ai aussi croisé Paul Leroy, il cherche un deux pièces sur Nantes, budget 300 000 maximum.";

async function main() {
  const modeles = (process.argv[2] ?? 'ministral-8b-latest,ministral-14b-latest').split(',');
  for (const mode of ['rapide', 'profond'] as const) {
    for (const m of modeles) {
      process.env.MISTRAL_MODEL_NOTE_LIVE = m;
      process.env.MISTRAL_MODEL_NOTE = m;
      const t = Date.now();
      try {
        const e = await extractNotePropositions(TEXTE, cle!, new Date('2026-09-30T10:00:00Z'), { mode });
        console.log(`${mode.padEnd(8)} ${m.padEnd(22)} ${String(Date.now() - t).padStart(6)} ms  actions=${e.actions?.length} personnes=${e.personnes.length}`);
      } catch (err) {
        console.log(`${mode} ${m} échec`, err instanceof Error ? err.message : err);
      }
    }
  }
}

void main();
