import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { reserverIa } from '@/lib/ia/quota';
import { EXEMPLES_PAR_COLONNE, MAX_COLONNES_RELUES, masquerExemple } from '@/lib/import/colonnes-ia';
import { formatConnu, relireColonnesAvecAssistant } from '@/lib/import/colonnes-ia-serveur';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Relie les colonnes d'un fichier atypique. Un format déjà importé est
 * reconnu sans appel ; sinon Mon assistant relit en-têtes et exemples
 * masqués. Rien à relier (quota, Mistral muet) : `origine: null`, l'écran
 * garde ce que les en-têtes disaient d'eux-mêmes.
 */
export async function POST(req: Request) {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
  }
  const payload = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
  const enTetes = (Array.isArray(payload.enTetes) ? payload.enTetes : [])
    .slice(0, MAX_COLONNES_RELUES)
    .map((h) => (typeof h === 'string' ? h.slice(0, 120) : ''));
  if (enTetes.length === 0) {
    return NextResponse.json({ error: 'Aucune colonne' }, { status: 400 });
  }
  // Masquées une seconde fois ici : rien d'autre ne part chez Mistral.
  const exemples = enTetes.map((_, i) => {
    const liste = Array.isArray(payload.exemples) ? (payload.exemples as unknown[])[i] : [];
    return (Array.isArray(liste) ? liste : [])
      .filter((v): v is string => typeof v === 'string')
      .slice(0, EXEMPLES_PAR_COLONNE)
      .map(masquerExemple);
  });

  const connu = await formatConnu(enTetes);
  if (connu) return NextResponse.json({ origine: 'connu', colonnes: connu });

  if (!(await reserverIa('import_colonnes'))) return NextResponse.json({ origine: null });

  const colonnes = await relireColonnesAvecAssistant(enTetes, exemples);
  return NextResponse.json(colonnes ? { origine: 'ia', colonnes } : { origine: null });
}
