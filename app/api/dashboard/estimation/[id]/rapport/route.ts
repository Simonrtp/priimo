import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { estNextResponse, sessionRapportEstimation } from '@/lib/rapport/acces';
import { appliquerModeleSiVide } from '@/lib/rapport/appliquer-modele';
import { identiteAgenceDepuisRow, identiteAgentDepuisProfil, piedBienDepuisEstimation } from '@/lib/rapport/depuis-session';
import { mapEnvoiRapport } from '@/lib/rapport/envois';
import { texteEmailModele } from '@/lib/rapport/modele-defaut';
import { mapPageComposee } from '@/lib/rapport/pages';
import { signerCheminRapport } from '@/lib/rapport/storage';

export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await sessionRapportEstimation(id);
  if (estNextResponse(ctx)) return ctx;

  const session = await createSupabaseServerClient();
  let rows;
  try {
    rows = await appliquerModeleSiVide(session, {
      estimationId: ctx.estimation.id,
      agencyId: ctx.agency.id,
    });
  } catch {
    return NextResponse.json({ error: 'Composition indisponible' }, { status: 500 });
  }

  const pages = await Promise.all(
    rows.map(async (row) =>
      mapPageComposee(row, row.storage_path ? await signerCheminRapport(row.storage_path) : null),
    ),
  );

  const [agence, agent, contactRes, envoisRes, emailRes] = await Promise.all([
    identiteAgenceDepuisRow(ctx.agency),
    Promise.resolve(identiteAgentDepuisProfil(ctx.profile, ctx.user.email)),
    ctx.estimation.contactId
      ? session
          .from('contacts')
          .select('email')
          .eq('id', ctx.estimation.contactId)
          .eq('agency_id', ctx.agency.id)
          .maybeSingle()
      : Promise.resolve({ data: null as { email: string | null } | null }),
    session
      .from('estimation_rapport_envois')
      .select('id, destinataire, version, envoye_at, premier_vu_at')
      .eq('estimation_id', ctx.estimation.id)
      .eq('agency_id', ctx.agency.id)
      .order('envoye_at', { ascending: false }),
    session.from('agencies').select('rapport_email_modele').eq('id', ctx.agency.id).maybeSingle(),
  ]);

  return NextResponse.json({
    pages,
    agence,
    agent,
    bien: piedBienDepuisEstimation(ctx.estimation),
    dateIso: ctx.estimation.updatedAt,
    contactEmail: contactRes.data?.email?.trim() || null,
    emailModele: texteEmailModele(emailRes.data?.rapport_email_modele),
    envois: (envoisRes.data ?? []).map(mapEnvoiRapport),
  });
}
