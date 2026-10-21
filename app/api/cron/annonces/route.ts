import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { traiterAnnoncesDuMatin } from '@/lib/annonces/matin';
import { relocaliserAnnoncesAjoutees } from '@/lib/annonces/import/relocaliser';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== 'production';
  return req.headers.get('authorization') === `Bearer ${secret}`;
}

/** Le pipeline a déjà tourné la veille au soir. La cloche part avec le brief de 7 h. */
export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }
  const admin = createSupabaseAdminClient();
  const ecrites = await traiterAnnoncesDuMatin(admin);
  // Annonces ajoutées encore sans adresse : leur DPE est peut-être publié depuis hier.
  const relocalisees = await relocaliserAnnoncesAjoutees(admin);
  return NextResponse.json({ ok: true, ecrites, relocalisees });
}
