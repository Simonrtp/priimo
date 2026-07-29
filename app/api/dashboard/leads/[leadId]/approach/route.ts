import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import {
  generateScriptApprocheForLead,
  parseStoredOrThrow,
  type LeadForApproach,
} from '@/lib/script-approche-generate';
import { parseScriptApproche } from '@/lib/script-approche';
import { clientIpFromRequest, pruneRateLimitBuckets, rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const maxDuration = 120;

type RouteParams = { params: Promise<{ leadId: string }> };

/**
 * POST /api/dashboard/leads/[leadId]/approach
 * Body optionnel : { force?: boolean } — force = régénération (réécrit la colonne).
 */
export async function POST(request: Request, { params }: RouteParams) {
  pruneRateLimitBuckets();
  const ip = clientIpFromRequest(request);
  const rl = rateLimit(`approach-gen:${ip}`, { limit: 20, windowMs: 60 * 60 * 1000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Trop de générations. Réessayez plus tard.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } },
    );
  }

  const { user, agency } = await getServerUser();
  if (!user || !agency) {
    return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
  }

  const { leadId } = await params;
  if (!leadId?.trim()) {
    return NextResponse.json({ error: 'Lead invalide.' }, { status: 400 });
  }

  let force = false;
  try {
    const body = (await request.json()) as { force?: unknown };
    force = Boolean(body?.force);
  } catch {
    // body vide OK
  }

  const supabase = await createSupabaseServerClient();
  const { data: leadRow, error: loadErr } = await supabase
    .from('leads')
    .select(
      [
        'id',
        'agency_id',
        'address',
        'property_type',
        'surface_m2',
        'etage',
        'score',
        'acquired_year',
        'owner_type',
        'owner_name',
        'owner_company',
        'company_name',
        'display_signals',
        'signals',
        'contacts_immeuble',
        'notes',
        'script_approche',
      ].join(','),
    )
    .eq('id', leadId)
    .maybeSingle();

  if (loadErr) {
    console.error('[approach] load', loadErr);
    return NextResponse.json({ error: 'Impossible de charger le lead.' }, { status: 500 });
  }
  if (!leadRow || (leadRow as { agency_id?: string }).agency_id !== agency.id) {
    return NextResponse.json({ error: 'Lead introuvable.' }, { status: 404 });
  }

  const existingRaw = (leadRow as { script_approche?: unknown }).script_approche;
  const existingParsed = parseScriptApproche(existingRaw);

  if (existingParsed && !force) {
    return NextResponse.json({
      script: existingParsed,
      alreadyExists: true,
    });
  }

  const leadForGen: LeadForApproach = {
    address: String((leadRow as { address?: string }).address ?? ''),
    property_type: (leadRow as { property_type?: string | null }).property_type ?? null,
    surface_m2: (leadRow as { surface_m2?: number | null }).surface_m2 ?? null,
    etage: (leadRow as { etage?: string | null }).etage ?? null,
    score: (leadRow as { score?: number | null }).score ?? null,
    acquired_year: (leadRow as { acquired_year?: number | null }).acquired_year ?? null,
    owner_type: (leadRow as { owner_type?: string | null }).owner_type ?? null,
    owner_name: (leadRow as { owner_name?: string | null }).owner_name ?? null,
    owner_company: (leadRow as { owner_company?: string | null }).owner_company ?? null,
    company_name: (leadRow as { company_name?: string | null }).company_name ?? null,
    display_signals: (leadRow as { display_signals?: unknown }).display_signals,
    signals: (leadRow as { signals?: unknown }).signals,
    contacts_immeuble: (leadRow as { contacts_immeuble?: unknown }).contacts_immeuble,
    notes: (leadRow as { notes?: string | null }).notes ?? null,
  };

  let stored;
  try {
    stored = await generateScriptApprocheForLead(leadForGen);
  } catch (e) {
    if (e instanceof Error && e.message === 'MISTRAL_API_KEY_MISSING') {
      return NextResponse.json(
        { error: 'Génération indisponible (clé Mistral non configurée).' },
        { status: 503 },
      );
    }
    console.error('[approach] generate', e);
    return NextResponse.json({ error: 'La génération a échoué. Réessayez.' }, { status: 502 });
  }

  if (!stored) {
    return NextResponse.json(
      { error: "Impossible de générer l'approche pour ce lead. Réessayez." },
      { status: 502 },
    );
  }

  // Écriture via service_role pour lock fiable (IS NULL) hors RLS UPDATE edge cases.
  const admin = createSupabaseAdminClient();

  if (!force) {
    const { data: written, error: writeErr } = await admin
      .from('leads')
      .update({ script_approche: stored })
      .eq('id', leadId)
      .eq('agency_id', agency.id)
      .is('script_approche', null)
      .select('script_approche')
      .maybeSingle();

    if (writeErr) {
      console.error('[approach] write', writeErr);
      return NextResponse.json({ error: 'Enregistrement impossible.' }, { status: 500 });
    }

    if (!written) {
      // Concurrent write : quelqu'un a déjà rempli la colonne.
      const { data: again } = await admin
        .from('leads')
        .select('script_approche')
        .eq('id', leadId)
        .maybeSingle();
      const concurrent = parseScriptApproche(again?.script_approche);
      if (concurrent) {
        return NextResponse.json({ script: concurrent, alreadyExists: true });
      }
      return NextResponse.json({ error: 'Enregistrement concurrent échoué.' }, { status: 409 });
    }

    return NextResponse.json({
      script: parseStoredOrThrow(written.script_approche),
      alreadyExists: false,
    });
  }

  const { data: rewritten, error: rewriteErr } = await admin
    .from('leads')
    .update({ script_approche: stored })
    .eq('id', leadId)
    .eq('agency_id', agency.id)
    .select('script_approche')
    .single();

  if (rewriteErr || !rewritten) {
    console.error('[approach] rewrite', rewriteErr);
    return NextResponse.json({ error: 'Enregistrement impossible.' }, { status: 500 });
  }

  return NextResponse.json({
    script: parseStoredOrThrow(rewritten.script_approche),
    alreadyExists: false,
    regenerated: true,
  });
}
