import { NextResponse } from 'next/server';
import { invaliderEstimation } from '@/lib/cache/dashboard';
import { randomBytes } from 'node:crypto';
import { getServerUser } from '@/lib/auth/getServerUser';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { canSeeOwnedRecord, viewerFromProfile } from '@/lib/agency/visibility';
import { runDvfEstimation } from '@/lib/estimation/dvf-engine';
import { motifDepuisSaisie } from '@/lib/estimation/moteur';
import {
  ESTIMATION_SELECT,
  lireHonorairesPct,
  mapEstimation,
  parseAnnexes,
  parseBien,
} from '@/lib/estimation/objet';
import { parseGrille } from '@/lib/estimation/objet';
import { appliquerQualiteEtAgent, capitaliser, type AjustementAgent } from '@/lib/estimation/valeur';
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
  const saisie = motifDepuisSaisie({
    surfaceM2: surface,
    propertyType,
    latitude: lat,
    longitude: lng,
    postalCode,
  });
  if (saisie || !address) {
    const motif = saisie ?? {
      code: 'adresse_incomplete' as const,
      motif: 'Adresse manquante.',
      action: 'Saisissez l’adresse, ou le prix à la main.',
    };
    const ctxActuel =
      row.context && typeof row.context === 'object' && !Array.isArray(row.context)
        ? (row.context as Record<string, unknown>)
        : {};
    const prixAgent =
      typeof ctxActuel.prixAgent === 'number' && ctxActuel.prixAgent > 0 ? ctxActuel.prixAgent : null;
    const { data: updated } = await session
      .from('agency_estimations')
      .update({
        available: false,
        price_value: prixAgent,
        price_low: null,
        price_high: null,
        price_per_m2: prixAgent != null && surface != null && surface > 0 ? Math.round(prixAgent / surface) : null,
        context: { ...ctxActuel, impossible: motif, moteurValeur: null },
      })
      .eq('id', id)
      .eq('agency_id', agency.id)
      .select(ESTIMATION_SELECT)
      .single();
    return NextResponse.json({
      estimation: updated ? mapEstimation(updated) : mapEstimation(row),
      decomposition: null,
      capitalisation: null,
      impossible: motif,
    });
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
      latitude: lat!,
      longitude: lng!,
      propertyType: propertyType!,
      surfaceM2: surface!,
      rooms: rooms ?? 1,
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
      dernierEtage: bien.dernierEtage,
      etagesImmeuble: bien.etagesImmeuble,
      annexes: annexes.map((a) => ({ libelle: a.libelle, valorisationEur: a.valorisationEur })),
      exclusIds: Array.isArray(body.exclusIds)
        ? body.exclusIds.filter((x): x is string => typeof x === 'string')
        : undefined,
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

  const decomposition =
    result.available && result.corrections.length > 0
      ? appliquerQualiteEtAgent(result.corrections, {
          grille,
          agent,
          honorairesPct: lireHonorairesPct(row.honoraires_pct),
          netVendeur,
          rangePct: 0,
        })
      : null;

  const cap = capitaliser({
    occupation: row.occupation === 'occupe' ? 'occupe' : 'libre',
    loyerAnnuel: row.loyer_annuel,
    honorairesPct: lireHonorairesPct(row.honoraires_pct),
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

  const ctxActuel =
    row.context && typeof row.context === 'object' && !Array.isArray(row.context)
      ? (row.context as Record<string, unknown>)
      : {};
  const prixAgentExistant =
    typeof ctxActuel.prixAgent === 'number' && ctxActuel.prixAgent > 0 ? ctxActuel.prixAgent : null;
  const moteurValeur = result.value != null && result.value > 0 ? result.value : null;
  const prixRetenu = prixAgentExistant ?? moteurValeur;
  const pricePerM2 =
    prixRetenu != null && surface != null && surface > 0 ? Math.round(prixRetenu / surface) : null;

  const context = {
    ...result.context,
    corrections: decomposition?.lignes ?? [],
    capitalisation: cap,
    netVendeur,
    agentAjustements: agent,
    moteurValeur,
    prixAgent: prixAgentExistant,
    majorationPct: ctxActuel.majorationPct ?? 0,
    impossible: result.impossible,
  };

  const { data: updated, error } = await session
    .from('agency_estimations')
    .update({
      available: result.available,
      price_value: prixRetenu,
      price_low: result.available ? result.low : null,
      price_high: result.available ? result.high : null,
      price_per_m2: pricePerM2,
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
