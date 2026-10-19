/**
 * Essai du parcours « coller l'URL d'une annonce » côté serveur, sans passer
 * par l'interface (pas de session de test). N'écrit rien tant que la table
 * annonces_imports n'existe pas.
 *
 *   npx tsx scripts/essai-import-annonce.ts <agencyId> <profileId> <cp> <url> [...]
 *   npx tsx scripts/essai-import-annonce.ts <agencyId> <profileId> <cp> --texte <url> <fichier.txt>
 */
import { readFileSync } from 'node:fs';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { importerTexte, importerUrl, type Qui, type ReponseImport } from '@/lib/annonces/import/serveur';
import { analyserUrl } from '@/lib/annonces/import/url';

function resume(r: ReponseImport): string {
  if (r.etat !== 'trouvee') return JSON.stringify(r);
  const c = r.carte;
  return `trouvée${c.annonceId ? ' (déjà dans les annonces)' : ''} | ${c.prix ?? '?'} € ${c.surface ?? '?'} m² ${c.pieces ?? '?'} p. ét.${c.etage ?? '?'} DPE ${c.dpe ?? '?'} | ${c.particulier ? 'particulier' : c.agence} | ${c.confiance} → ${c.adresse ?? (c.latitude != null ? 'secteur approximatif' : 'sans position')} | parcelle ${c.parcelleId ?? '—'} | ajout ${r.disponible ? 'possible' : 'indisponible'}`;
}

async function main() {
  const [agencyId, profileId, cp, ...reste] = process.argv.slice(2);
  const qui: Qui = { agencyId: agencyId!, profileId: profileId!, codesPostaux: [cp!], pagesAutorisees: true };
  const admin = createSupabaseAdminClient() as unknown as SupabaseClient;
  if (reste[0] === '--texte') {
    const u = analyserUrl(reste[1]!)!;
    const t0 = Date.now();
    const r = await importerTexte(admin, qui, u, readFileSync(reste[2]!, 'utf8'));
    console.log(`TEXTE ${u.portail} → ${resume(r)} (${Date.now() - t0} ms)`);
    return;
  }
  for (const brute of reste) {
    const u = analyserUrl(brute);
    if (!u) {
      console.log('URL illisible :', brute);
      continue;
    }
    const t0 = Date.now();
    const r = await importerUrl(admin, admin, qui, u);
    console.log(`${u.portail.padEnd(9)} ${resume(r)} (${Date.now() - t0} ms)`);
  }
}

void main();
