import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { clientIpFromRequest, rateLimit } from '@/lib/rate-limit';
import { estNextResponse, sessionRapportEstimation } from '@/lib/rapport/acces';
import { identiteAgenceDepuisRow, identiteAgentDepuisProfil, piedBienDepuisEstimation } from '@/lib/rapport/depuis-session';
import { mapPageComposee } from '@/lib/rapport/pages';
import { genererPdfRapport } from '@/lib/rapport/pdf';
import { joindreSansVide } from '@/lib/rapport/identite';
import { sendAvisValeurEmail } from '@/lib/email/sendAvisValeurEmail';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await sessionRapportEstimation(id);
  if (estNextResponse(ctx)) return ctx;

  const limit = rateLimit(`rapport-mail:${clientIpFromRequest(req)}`, {
    limit: 12,
    windowMs: 10 * 60 * 1000,
  });
  if (!limit.ok) return NextResponse.json({ error: 'Trop d’envois' }, { status: 429 });

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  let to = typeof body.to === 'string' ? body.to.trim() : '';
  if (!to && ctx.estimation.contactId) {
    const session = await createSupabaseServerClient();
    const { data: contact } = await session
      .from('contacts')
      .select('email')
      .eq('id', ctx.estimation.contactId)
      .eq('agency_id', ctx.agency.id)
      .maybeSingle();
    to = contact?.email?.trim() ?? '';
  }
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return NextResponse.json({ error: 'Indiquez un e-mail destinataire' }, { status: 400 });
  }

  const session = await createSupabaseServerClient();
  const { data, error } = await session
    .from('estimation_rapport_pages')
    .select('*')
    .eq('estimation_id', ctx.estimation.id)
    .eq('agency_id', ctx.agency.id)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) {
    return NextResponse.json({ error: 'Composition indisponible' }, { status: 500 });
  }

  const pages = (data ?? []).map((row) => mapPageComposee(row, null));
  const agence = await identiteAgenceDepuisRow(ctx.agency);
  const agent = identiteAgentDepuisProfil(ctx.profile, ctx.user.email);
  const bien = piedBienDepuisEstimation(ctx.estimation);
  const pdf = await genererPdfRapport({
    agence,
    agent,
    bien,
    dateIso: ctx.estimation.updatedAt,
    pages,
  });

  try {
    await sendAvisValeurEmail({
      to,
      agentNom: agent.nom ?? agence.nomCommercial,
      agenceNom: agence.nomCommercial,
      bienLabel: joindreSansVide([bien.adresse, bien.ville], ', '),
      pdf,
    });
  } catch (err) {
    console.error('[rapport] email', err);
    return NextResponse.json({ error: 'Envoi impossible' }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
