import { after, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { planifierNuit, traiterTranche } from '@/lib/annonces/balayage/balayer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** Au plus ces relais par nuit : ~10 pages chacun, de quoi lire le stock du premier soir. */
const RELAIS_MAX = 60;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== 'production';
  return req.headers.get('authorization') === `Bearer ${secret}`;
}

/**
 * Chaque nuit : le balayage des annonces de particuliers (lib/annonces/balayage).
 * Les pages arrivent en 5 à 50 s : chaque appel répond tout de suite, travaille
 * quelques minutes après sa réponse, puis se relance (`?relais=n`) tant que la
 * file n'est pas vide — jusqu'au plafond de pages du jour.
 */
export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }
  const url = new URL(req.url);
  const relais = Math.max(0, Number(url.searchParams.get('relais')) || 0);
  const admin = createSupabaseAdminClient() as unknown as SupabaseClient;
  const plan = relais === 0 ? await planifierNuit(admin) : null;

  after(async () => {
    const tranche = await traiterTranche(admin);
    console.log('[balayage] tranche', relais, JSON.stringify(tranche));
    if (tranche.restantes === 0 || tranche.plafond || tranche.traitees === 0 || relais + 1 >= RELAIS_MAX) return;
    const suite = new URL(url.pathname, url.origin);
    suite.searchParams.set('relais', String(relais + 1));
    const secret = process.env.CRON_SECRET;
    // Le relais répond aussitôt (son travail se fait après sa réponse) : on n'attend que son accusé.
    const res = await fetch(suite, { headers: secret ? { authorization: `Bearer ${secret}` } : {}, cache: 'no-store' }).catch((err: unknown) => {
      console.error('[balayage] relais', err instanceof Error ? err.message : err);
      return null;
    });
    if (res && !res.ok) console.error('[balayage] relais refusé', res.status);
  });

  return NextResponse.json({ ok: true, relais, plan });
}
