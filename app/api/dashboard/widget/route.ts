import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ensureWidgetForAgency } from '@/lib/widget/config';
import { normalizeDomainList } from '@/lib/widget/domains';
import { SITE_URL } from '@/lib/site-url';
import type { AgencyWidgetRow } from '@/types/database';

export const runtime = 'nodejs';

const MAX_DOMAINS = 20;

/** Ce que le dashboard affiche : configuration + code prêt à copier. */
function payload(config: {
  publicId: string;
  enabled: boolean;
  displayName: string;
  accentColor: string;
  logoUrl: string | null;
  allowedDomains: string[];
  dailyCap: number;
}) {
  return {
    publicId: config.publicId,
    enabled: config.enabled,
    displayName: config.displayName,
    accentColor: config.accentColor,
    logoUrl: config.logoUrl,
    allowedDomains: config.allowedDomains,
    dailyCap: config.dailyCap,
    scriptUrl: `${SITE_URL}/embed/v1.js`,
    pageUrl: `${SITE_URL}/e/${config.publicId}`,
  };
}

export async function GET() {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const supabase = await createSupabaseServerClient();
  const config = await ensureWidgetForAgency(supabase, agency.id);
  if (!config) {
    return NextResponse.json({ error: 'Configuration indisponible' }, { status: 500 });
  }

  return NextResponse.json(payload(config));
}

export async function PATCH(req: Request) {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }
  // Le widget engage l'agence vis-à-vis de ses visiteurs : seul le directeur
  // décide de l'activer et des domaines qui peuvent le porter.
  if (profile.role !== 'directeur') {
    return NextResponse.json({ error: 'Réservé au directeur' }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const existing = await ensureWidgetForAgency(supabase, agency.id);
  if (!existing) {
    return NextResponse.json({ error: 'Configuration indisponible' }, { status: 500 });
  }

  const patch: Partial<AgencyWidgetRow> = {};

  if (typeof body.enabled === 'boolean') patch.enabled = body.enabled;

  if (typeof body.displayName === 'string') {
    const name = body.displayName.trim().slice(0, 120);
    patch.display_name = name || null;
  }

  if (typeof body.accentColor === 'string') {
    const color = body.accentColor.trim();
    if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
      return NextResponse.json({ error: 'Couleur invalide (format #RRGGBB)' }, { status: 400 });
    }
    patch.accent_color = color.toUpperCase();
  }

  if (typeof body.logoUrl === 'string') {
    const raw = body.logoUrl.trim();
    if (!raw) {
      patch.logo_url = null;
    } else {
      try {
        const url = new URL(raw);
        if (url.protocol !== 'https:') throw new Error('https requis');
        patch.logo_url = url.toString().slice(0, 500);
      } catch {
        return NextResponse.json(
          { error: 'Le logo doit être une adresse https complète.' },
          { status: 400 },
        );
      }
    }
  }

  if (Array.isArray(body.allowedDomains)) {
    const domains = normalizeDomainList(
      body.allowedDomains.filter((d): d is string => typeof d === 'string'),
    );
    if (domains.length > MAX_DOMAINS) {
      return NextResponse.json(
        { error: `Pas plus de ${MAX_DOMAINS} domaines.` },
        { status: 400 },
      );
    }
    patch.allowed_domains = domains;
  }

  if (body.dailyCap !== undefined) {
    const cap = Number(body.dailyCap);
    if (!Number.isFinite(cap) || cap < 1 || cap > 5000) {
      return NextResponse.json(
        { error: 'Le plafond quotidien doit être compris entre 1 et 5000.' },
        { status: 400 },
      );
    }
    patch.daily_cap = Math.round(cap);
  }

  // Activer un widget sans domaine autorisé ne servirait à rien : il serait
  // refusé partout. Autant le dire au lieu d'enregistrer un réglage inerte.
  const domainesApres = (patch.allowed_domains as string[] | undefined) ?? existing.allowedDomains;
  if (patch.enabled === true && domainesApres.length === 0) {
    return NextResponse.json(
      { error: 'Ajoutez au moins un domaine autorisé avant d’activer le widget.' },
      { status: 400 },
    );
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json(payload(existing));
  }

  const { error } = await supabase
    .from('agency_widgets')
    .update(patch)
    .eq('agency_id', agency.id);

  if (error) {
    console.error('[widget] mise à jour', error);
    return NextResponse.json({ error: 'Enregistrement impossible' }, { status: 500 });
  }

  const updated = await ensureWidgetForAgency(supabase, agency.id);
  return NextResponse.json(payload(updated ?? existing));
}
