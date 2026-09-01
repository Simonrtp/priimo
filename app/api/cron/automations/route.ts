import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { collecterPropositions } from '@/lib/automations/collecte';
import {
  deposerPropositions,
  ecrireCurseur,
  expirerPropositions,
} from '@/lib/queries/actions';

/**
 * Passage quotidien des automatisations.
 *
 * Une agence qui échoue n'empêche pas les suivantes : le cron rend toujours
 * 200 avec le détail par agence, sans quoi Vercel réessaierait tout le lot
 * pour une seule agence en défaut.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== 'production';
  return req.headers.get('authorization') === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  const now = new Date();

  const { data: agencies, error } = await admin.from('agencies').select('id, codes_postaux');
  if (error) {
    console.error('[cron/automations]', error);
    return NextResponse.json({ error: 'Lecture agences impossible' }, { status: 500 });
  }

  // Les propositions périmées partent d'abord : inutile de faire cohabiter un
  // signal froid avec ceux du jour.
  const expirees = await expirerPropositions(admin, now);

  const journal: {
    agencyId: string;
    proposees: number;
    nouvelles: number;
    echecs: string[];
  }[] = [];

  for (const agency of agencies ?? []) {
    const agencyId = agency.id as string;
    const codesPostaux = (agency.codes_postaux ?? []) as string[];

    const { propositions, echecs } = await collecterPropositions(
      admin,
      { id: agencyId, codesPostaux },
      now,
    );
    const nouvelles = await deposerPropositions(admin, agencyId, propositions);

    await ecrireCurseur(
      admin,
      agencyId,
      'quotidien',
      { proposees: propositions.length, nouvelles },
      echecs.length > 0 ? echecs.map((e) => `${e.automation}: ${e.message}`).join(' | ') : null,
    );

    journal.push({
      agencyId,
      proposees: propositions.length,
      nouvelles,
      echecs: echecs.map((e) => e.automation),
    });
  }

  return NextResponse.json({
    ok: true,
    expirees,
    agences: journal.length,
    nouvelles: journal.reduce((n, a) => n + a.nouvelles, 0),
    journal,
  });
}
