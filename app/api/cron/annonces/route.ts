import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { relocaliserAnnoncesAjoutees } from '@/lib/annonces/import/relocaliser';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== 'production';
  return req.headers.get('authorization') === `Bearer ${secret}`;
}

/** Chaque matin : les annonces ajoutées encore sans adresse sont relocalisées (base DPE publiée par lots). */
export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }
  const admin = createSupabaseAdminClient();
  const relocalisees = await relocaliserAnnoncesAjoutees(admin);
  return NextResponse.json({ ok: true, relocalisees });
}
