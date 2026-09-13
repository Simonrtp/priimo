import { NextResponse } from 'next/server';
import { invaliderEstimation } from '@/lib/cache/dashboard';
import { randomBytes } from 'node:crypto';
import { getServerUser } from '@/lib/auth/getServerUser';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { canSeeOwnedRecord, viewerFromProfile } from '@/lib/agency/visibility';
import { runDvfEstimation } from '@/lib/estimation/dvf-engine';
import { ESTIMATION_SELECT, mapEstimation, parseAnnexes, parseBien } from '@/lib/estimation/objet';
import { parseGrille } from '@/lib/estimation/objet';
import { appliquerQualiteEtAgent, capitaliser, type AjustementAgent } from '@/lib/estimation/valeur';
import { CONFIG_ESTIMATION } from '@/lib/estimation';
import type { EstimationFeatureKey } from '@/lib/estimation';

export const runtime = 'nodejs';

const SHARE_TTL_DAYS = 90;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }
  const { refuserSiEstimationFermee } = await import('@/lib/billing/exiger');
  const ferme = refuserSiEstimationFermee(agency);
  if (ferme) return ferme;
  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Identifiant manquant' }, { status: 400 });

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  const session = await createSupabaseServerClient();
  const { data: row, error: fetchErr } = await session
    .from('agency_estimations')
    .select(ESTIMATION_SELECT)
    .eq('id', id)
    .eq('agency_id', agency.id)
    .maybeSingle();
  if (fetchErr || !row) {
    return NextResponse.json({ error: 'Estimation introuvable' }, { status: 404 });
  }

  const viewer = viewerFromProfile(profile);
  if (
    !canSeeOwnedRecord(viewer, { assignedTo: row.referent_id, createdBy: row.created_by })
  ) {
    return NextResponse.json({ error: 'Estimation introuvable' }, { status: 404 });
  }

  const address = (row.address ?? '').trim();
  const postalCode = (row.postal_code ?? '').trim();
  const lat = row.latitude;
  const lng = row.longitude;
  const surface = row.surface_m2;
  const rooms = row.rooms;
  const propertyType =
    row.property_type === 'maison' || row.property_type === 'appartement'
      ? row.property_type
      : null;
  if (!address || !/^\d{5}$/.test(postalCode) || !propertyType) {
    return NextResponse.json({ error: 'Adresse et type de bien requis' }, { status: 400 });
  }
  if (lat == null || lng == null || surface == null || surface <= 0 || rooms == null || rooms <= 0) {
    return NextResponse.json({ error: 'Surface, pièces et position requises' }, { status: 400 });
  }

  const bien = parseBien(row.bien);
  const annexes = parseAnnexes(row.annexes);
  const grille = parseGrille(row.grille);
  const features: EstimationFeatureKey[] = [];
  if (bien.balconTerrasse) features.push('balcon_terrasse');
  if (annexes.some((a) => /cave|cellier/i.test(a.libelle))) features.push('cave');
  if (annexes.some((a) => /parking|garage|box/i.test(a.libelle))) features.push('parking');

  const admin = createSupabaseAdminClient();
  const result = await runDvfEstimation(
    admin,
    {
      address,
      postalCode,
      city: row.city,
      banId: row.ban_id,
      latitude: lat,
      longitude: lng,
      propertyType,
      surfaceM2: surface,
      rooms,
      floor: row.floor,
      hasElevator: bien.ascenseur,
      conditionRating: null,
      dpeClass: row.dpe_class,
      features,
      extras: {
        terrainM2: bien.surfaceTerrain,
        niveaux: bien.niveaux,
        balconM2: bien.balconTerrasse ? 12 : null,
        chargesMensuelles: bien.chargesAnnuelles != null ? Math.round(bien.chargesAnnuelles / 12) : null,
      },
    },
    agency.id,
    async () => undefined,
    { sansBienici: true },
  );

  const netVendeur = body.netVendeur === true;
  const agent: AjustementAgent = {
    travauxEur: num(body.travauxEur) ?? 0,
    decoteOccupationEur: num(body.decoteOccupationEur) ?? 0,
    autresEur: num(body.autresEur) ?? 0,
    justification: typeof body.justification === 'string' ? body.justification : null,
  };

  const decomposition = appliquerQualiteEtAgent(result.corrections, {
    grille,
    agent,
    honorairesPct: Number(row.honoraires_pct) || 5,
    netVendeur,
    rangePct: CONFIG_ESTIMATION.RANGE_PCT,
  });

  const cap = capitaliser({
    occupation: row.occupation === 'occupe' ? 'occupe' : 'libre',
    loyerAnnuel: row.loyer_annuel,
    honorairesPct: Number(row.honoraires_pct) || 5,
    netVendeur,
  });

  const shareToken = row.share_token ?? randomBytes(24).toString('base64url');
  const expires = row.share_expires_at
    ? new Date(row.share_expires_at)
    : (() => {
        const d = new Date();
        d.setDate(d.getDate() + SHARE_TTL_DAYS);
        return d;
      })();

  const context = {
    ...result.context,
    corrections: decomposition.lignes,
    capitalisation: cap,
    netVendeur,
    agentAjustements: agent,
  };

  const { data: updated, error } = await session
    .from('agency_estimations')
    .update({
      available: result.available,
      price_value: decomposition.valeur,
      price_low: decomposition.low,
      price_high: decomposition.high,
      price_per_m2: result.pricePerM2,
      reliability: result.reliability,
      reliability_label: result.reliabilityLabel,
      steps: result.steps,
      comparables: result.comparables,
      context,
      parcelle_id: result.parcelleId ?? row.parcelle_id,
      share_token: shareToken,
      share_expires_at: expires.toISOString(),
    })
    .eq('id', id)
    .eq('agency_id', agency.id)
    .select(ESTIMATION_SELECT)
    .single();

  if (error || !updated) {
    return NextResponse.json({ error: 'Enregistrement du calcul impossible' }, { status: 500 });
  }

  invaliderEstimation();

  return NextResponse.json({
    estimation: mapEstimation(updated),
    decomposition,
    capitalisation: cap,
  });
}

function num(raw: unknown): number | null {
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(n) ? n : null;
}
