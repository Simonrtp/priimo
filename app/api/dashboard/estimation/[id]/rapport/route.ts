import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { estNextResponse, sessionRapportEstimation } from '@/lib/rapport/acces';
import { assemblerRapport } from '@/lib/rapport/genere/assembler';
import { piedBienDepuisEstimation } from '@/lib/rapport/depuis-session';
import { mapEnvoiRapport } from '@/lib/rapport/envois';
import { texteEmailModele } from '@/lib/rapport/modele-defaut';

export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await sessionRapportEstimation(id);
  if (estNextResponse(ctx)) return ctx;

  const session = await createSupabaseServerClient();
  let assemble;
  try {
    assemble = await assemblerRapport(session, ctx);
  } catch {
    return NextResponse.json({ error: 'Composition indisponible' }, { status: 500 });
  }

  const { data: envois } = await session
    .from('estimation_rapport_envois')
    .select('id, destinataire, version, envoye_at, premier_vu_at')
    .eq('estimation_id', ctx.estimation.id)
    .eq('agency_id', ctx.agency.id)
    .order('envoye_at', { ascending: false });

  return NextResponse.json({
    pages: assemble.pages,
    dossier: assemble.dossier,
    agence: assemble.agence,
    agent: assemble.agent,
    bien: piedBienDepuisEstimation(ctx.estimation),
    dateIso: ctx.estimation.updatedAt,
    contactEmail: assemble.dossier.client.email,
    emailModele: texteEmailModele(assemble.emailModele),
    envois: (envois ?? []).map(mapEnvoiRapport),
  });
}
