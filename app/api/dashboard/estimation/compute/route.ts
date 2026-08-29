import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { getServerUser } from '@/lib/auth/getServerUser';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  runDvfEstimation,
  type DvfEngineInput,
  type EstimationStep,
} from '@/lib/estimation/dvf-engine';
import type { EstimationFeatureKey } from '@/lib/estimation';
import { parseExtras } from '@/lib/estimation/extras';

export const runtime = 'nodejs';

const SHARE_TTL_DAYS = 90;

const FEATURE_KEYS: EstimationFeatureKey[] = [
  'balcon_terrasse',
  'cave',
  'parking',
  'gardien',
  'travaux_recents',
];

function parseFeatures(raw: unknown): EstimationFeatureKey[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((f): f is EstimationFeatureKey =>
    typeof f === 'string' && (FEATURE_KEYS as string[]).includes(f),
  );
}

function parseInput(body: unknown): DvfEngineInput | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  const address = typeof b.address === 'string' ? b.address.trim() : '';
  const postalCode = typeof b.postalCode === 'string' ? b.postalCode.trim() : '';
  const lat = typeof b.latitude === 'number' ? b.latitude : Number(b.latitude);
  const lng = typeof b.longitude === 'number' ? b.longitude : Number(b.longitude);
  const surfaceM2 = typeof b.surfaceM2 === 'number' ? b.surfaceM2 : Number(b.surfaceM2);
  const rooms = typeof b.rooms === 'number' ? b.rooms : Number(b.rooms);
  const propertyType =
    b.propertyType === 'maison' ? 'maison' : b.propertyType === 'appartement' ? 'appartement' : null;
  if (!address || !/^\d{5}$/.test(postalCode) || !propertyType) return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(surfaceM2) || surfaceM2 <= 0) {
    return null;
  }
  if (!Number.isFinite(rooms) || rooms <= 0) return null;

  const conditionRaw = b.conditionRating;
  const conditionRating =
    conditionRaw === 1 || conditionRaw === 2 || conditionRaw === 3 || conditionRaw === 4
      ? conditionRaw
      : conditionRaw === '1' || conditionRaw === '2' || conditionRaw === '3' || conditionRaw === '4'
        ? (Number(conditionRaw) as 1 | 2 | 3 | 4)
        : null;

  const hasElevator =
    b.hasElevator === true ? true : b.hasElevator === false ? false : null;

  return {
    address,
    postalCode,
    city: typeof b.city === 'string' ? b.city : null,
    banId: typeof b.banId === 'string' ? b.banId : null,
    latitude: lat,
    longitude: lng,
    propertyType,
    surfaceM2: Math.round(surfaceM2),
    rooms: Math.round(rooms),
    floor: typeof b.floor === 'string' && b.floor !== 'inconnu' ? b.floor : null,
    hasElevator,
    conditionRating,
    dpeClass:
      typeof b.dpeClass === 'string' && b.dpeClass !== 'inconnu' ? b.dpeClass : null,
    features: parseFeatures(b.features),
  };
}

/**
 * POST — stream NDJSON : une ligne par étape, puis une ligne `result` + `id`.
 * Aucune temporisation artificielle.
 */
export async function POST(req: Request) {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 });
  }

  const input = parseInput(raw);
  if (!input) {
    return NextResponse.json({ error: 'Entrées incompletes' }, { status: 400 });
  }

  // Les critères complémentaires entrent dans le calcul, ils ne sont pas
  // seulement archivés : chacun produit une ligne dans le détail du calcul.
  const extras = parseExtras(raw);

  const encoder = new TextEncoder();
  const admin = createSupabaseAdminClient();
  const session = await createSupabaseServerClient();

  const stream = new ReadableStream({
    async start(controller) {
      function send(obj: unknown) {
        controller.enqueue(encoder.encode(`${JSON.stringify(obj)}\n`));
      }

      try {
        const result = await runDvfEstimation(
          admin,
          { ...input, extras },
          agency.id,
          async (step: EstimationStep) => {
            send({ type: 'step', step });
          },
          { sansBienici: true },
        );

        const shareToken = randomBytes(24).toString('base64url');
        const expires = new Date();
        expires.setDate(expires.getDate() + SHARE_TTL_DAYS);

        const context = {
          ...result.context,
          corrections: result.corrections,
          extras,
        };

        const { data: row, error } = await session
          .from('agency_estimations')
          .insert({
            agency_id: agency.id,
            created_by: profile.id,
            address: input.address,
            postal_code: input.postalCode,
            city: input.city,
            ban_id: input.banId,
            parcelle_id: result.parcelleId,
            latitude: input.latitude,
            longitude: input.longitude,
            property_type: input.propertyType,
            surface_m2: input.surfaceM2,
            rooms: input.rooms,
            floor: input.floor,
            condition_rating: input.conditionRating,
            dpe_class: input.dpeClass,
            available: result.available,
            price_value: result.value,
            price_low: result.low,
            price_high: result.high,
            price_per_m2: result.pricePerM2,
            reliability: result.reliability,
            reliability_label: result.reliabilityLabel,
            steps: result.steps,
            comparables: result.comparables,
            context,
            share_token: shareToken,
            share_expires_at: expires.toISOString(),
          })
          .select('id, share_token')
          .single();

        if (error || !row) {
          // Pas d’erreur brute côté UI : on renvoie quand même le résultat calculé.
          send({
            type: 'result',
            id: 'local',
            shareToken: null,
            result: { ...result, context },
          });
          controller.close();
          return;
        }

        send({
          type: 'result',
          id: row.id,
          shareToken: row.share_token,
          shareExpiresAt: expires.toISOString(),
          result: { ...result, context },
        });
      } catch (err) {
        console.error('[estimation/compute]', err);
        send({
          type: 'result',
          id: 'local',
          shareToken: null,
          result: {
            available: false,
            value: null,
            low: null,
            high: null,
            pricePerM2: null,
            reliability: 0,
            reliabilityLabel: 'Fiabilité limitée',
            comparables: [],
            corrections: [],
            steps: [],
            sources: [],
            context: {
              degradationCode: 'secteur_non_couvert',
              degradationLabel:
                'Ce secteur n’est pas encore couvert par nos données de ventes. Nous chargeons actuellement Paris et la Haute-Savoie.',
              immeubleVentes: 0,
              quartierVentes: 0,
            },
          },
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
