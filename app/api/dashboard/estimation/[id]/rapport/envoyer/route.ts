import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { clientIpFromRequest, rateLimit } from '@/lib/rate-limit';
import { estNextResponse, sessionRapportEstimation } from '@/lib/rapport/acces';
import { identiteAgentDepuisProfil, piedBienDepuisEstimation } from '@/lib/rapport/depuis-session';
import { emailDestinataireValide, mapEnvoiRapport } from '@/lib/rapport/envois';
import { assemblerRapport } from '@/lib/rapport/genere/assembler';
import { pageExportable } from '@/lib/rapport/pages';
import { ChromiumIndisponible, genererPdfRapport } from '@/lib/rapport/pdf';
import { joindreSansVide } from '@/lib/rapport/identite';
import { cheminEnvoi, deposerRapport } from '@/lib/rapport/storage';
import { sendAvisValeurEmail } from '@/lib/email/sendAvisValeurEmail';
import { absoluteUrl } from '@/lib/site-url';

export const runtime = 'nodejs';
export const maxDuration = 60;

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

  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (!message) {
    return NextResponse.json({ error: 'Indiquez un message pour votre client' }, { status: 400 });
  }
  if (message.length > 4000) {
    return NextResponse.json({ error: 'Message trop long' }, { status: 400 });
  }

  let to = typeof body.to === 'string' ? body.to.trim() : '';
  const session = await createSupabaseServerClient();
  if (!to && ctx.estimation.contactId) {
    const { data: contact } = await session
      .from('contacts')
      .select('email')
      .eq('id', ctx.estimation.contactId)
      .eq('agency_id', ctx.agency.id)
      .maybeSingle();
    to = contact?.email?.trim() ?? '';
  }
  if (!to || !emailDestinataireValide(to)) {
    return NextResponse.json({ error: 'Indiquez un e-mail destinataire' }, { status: 400 });
  }

  const replyTo = identiteAgentDepuisProfil(ctx.profile, ctx.user.email).email;
  if (!replyTo) {
    return NextResponse.json({ error: 'E-mail de l’agent manquant' }, { status: 400 });
  }

  let assemble;
  try {
    assemble = await assemblerRapport(session, ctx, { signer: false });
  } catch {
    return NextResponse.json({ error: 'Composition indisponible' }, { status: 500 });
  }
  const pages = assemble.pages.filter(pageExportable);
  if (pages.length === 0) {
    return NextResponse.json({ error: 'Ajoutez au moins une page au rapport' }, { status: 400 });
  }

  const agence = assemble.agence;
  const agent = assemble.agent;
  const bien = piedBienDepuisEstimation(ctx.estimation);
  const bienLabel = joindreSansVide([bien.adresse, bien.ville], ', ');
  let pdf: Uint8Array;
  try {
    pdf = await genererPdfRapport({
      agence,
      agent,
      bien,
      dateIso: ctx.estimation.updatedAt,
      pages,
      dossier: assemble.dossier,
    });
  } catch (err) {
    if (err instanceof ChromiumIndisponible) {
      return NextResponse.json(
        {
          error: 'Impression serveur indisponible. Utilisez Imprimer depuis le navigateur.',
          imprimer: `/imprimer/estimation/${id}`,
        },
        { status: 503 },
      );
    }
    throw err;
  }

  const { data: dernier } = await session
    .from('estimation_rapport_envois')
    .select('version')
    .eq('estimation_id', ctx.estimation.id)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();
  const version = (dernier?.version ?? 0) + 1;
  const envoiId = crypto.randomUUID();
  const token = randomBytes(24).toString('base64url');
  const pdfPath = cheminEnvoi(ctx.agency.id, envoiId);

  const depot = await deposerRapport(pdfPath, Buffer.from(pdf), 'application/pdf');
  if (depot.error) {
    console.error('[rapport] stockage envoi', depot.error);
    return NextResponse.json({ error: 'Envoi impossible' }, { status: 500 });
  }

  const { data: envoi, error: insertErr } = await session
    .from('estimation_rapport_envois')
    .insert({
      id: envoiId,
      estimation_id: ctx.estimation.id,
      agency_id: ctx.agency.id,
      token,
      destinataire: to,
      message,
      version,
      pdf_path: pdfPath,
      bien_label: bienLabel,
      agence_nom: agence.nomCommercial,
      agent_nom: agent.nom,
      created_by: ctx.profile.id,
    })
    .select('id, destinataire, version, envoye_at, premier_vu_at')
    .maybeSingle();

  if (insertErr || !envoi) {
    console.error('[rapport] envoi insert', insertErr);
    return NextResponse.json({ error: 'Envoi impossible' }, { status: 500 });
  }

  try {
    await sendAvisValeurEmail({
      to,
      agentNom: agent.nom ?? agence.nomCommercial,
      agenceNom: agence.nomCommercial,
      replyTo,
      message,
      lien: absoluteUrl(`/rapport/${token}`),
      bienLabel,
    });
  } catch (err) {
    console.error('[rapport] email', err);
    await session.from('estimation_rapport_envois').delete().eq('id', envoiId);
    return NextResponse.json({ error: 'Envoi impossible' }, { status: 502 });
  }

  return NextResponse.json({ ok: true, envoi: mapEnvoiRapport(envoi) });
}
