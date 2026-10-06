import { NextResponse } from 'next/server';
import { invaliderEstimation } from '@/lib/cache/dashboard';
import { getServerUser } from '@/lib/auth/getServerUser';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { canSeeLeadRecord, canSeeOwnedRecord, viewerFromProfile } from '@/lib/agency/visibility';
import { visibleEstimationsFor } from '@/lib/agency/scope-records';
import { isEtat, isMotif } from '@/lib/estimation/cycle';
import { enregistrerEstimationEvent } from '@/lib/estimation/evenement';
import {
  ESTIMATION_LIST_SELECT,
  ESTIMATION_SELECT,
  mapEstimation,
  parsePhotos,
  type EstimationBien,
  type EstimationPhoto,
  BIEN_VIDE,
} from '@/lib/estimation/objet';

export const runtime = 'nodejs';

export async function GET() {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const session = await createSupabaseServerClient();
  const { data, error } = await session
    .from('agency_estimations')
    .select(ESTIMATION_LIST_SELECT)
    .eq('agency_id', agency.id)
    .order('updated_at', { ascending: false })
    .limit(80);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const viewer = viewerFromProfile(profile);
  const visible = visibleEstimationsFor(
    viewer,
    (data ?? []).map((r) => ({
      ...r,
      referentId: r.referent_id,
      createdBy: r.created_by,
    })),
  );

  return NextResponse.json({
    estimations: visible.map((r) => ({
      id: r.id,
      address: r.address,
      postalCode: r.postal_code,
      city: r.city,
      motif: isMotif(r.motif) ? r.motif : 'projet_vente',
      etat: isEtat(r.etat) ? r.etat : 'brouillon',
      referentId: r.referent_id,
      priceValue: r.price_value,
      priceLow: r.price_low,
      priceHigh: r.price_high,
      available: r.available,
      occupation: r.occupation,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    })),
  });
}

export async function POST(req: Request) {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }
  const { refuserSiEstimationFermee } = await import('@/lib/billing/exiger');
  const ferme = refuserSiEstimationFermee(agency);
  if (ferme) return ferme;

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  const session = await createSupabaseServerClient();
  const viewer = viewerFromProfile(profile);
  const prefill = await chargerPrefill(session, {
    agencyId: agency.id,
    viewer,
    leadId: typeof body.leadId === 'string' ? body.leadId : null,
    bienId: typeof body.bienId === 'string' ? body.bienId : null,
  });
  if (prefill && estErreurPrefill(prefill)) {
    return NextResponse.json({ error: prefill.error }, { status: prefill.status });
  }

  const { data, error } = await session
    .from('agency_estimations')
    .insert({
      agency_id: agency.id,
      created_by: profile.id,
      referent_id: profile.id,
      motif: 'projet_vente',
      etat: 'brouillon',
      occupation: 'libre',
      honoraires_pct: 5,
      ...(prefill ?? {}),
    })
    .select(ESTIMATION_SELECT)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Création impossible' }, { status: 500 });
  }

  await enregistrerEstimationEvent(session, {
    agencyId: agency.id,
    estimationId: data.id,
    profileId: profile.id,
    kind: 'created',
  });

  invaliderEstimation();

  return NextResponse.json({ estimation: mapEstimation(data) });
}

async function chargerPrefill(
  session: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  input: {
    agencyId: string;
    viewer: ReturnType<typeof viewerFromProfile>;
    leadId: string | null;
    bienId: string | null;
  },
): Promise<Record<string, unknown> | { error: string; status: number } | null> {
  if (input.leadId) {
    const { data: lead } = await session
      .from('leads')
      .select(
        'id, assigned_to, address, postal_code, city, ban_id, latitude, longitude, property_type, surface_m2, rooms, etage, dpe_class',
      )
      .eq('id', input.leadId)
      .eq('agency_id', input.agencyId)
      .maybeSingle();
    if (!lead) return { error: 'Prospect introuvable', status: 404 };
    if (!canSeeLeadRecord(input.viewer, { assignedTo: lead.assigned_to })) {
      return { error: 'Prospect introuvable', status: 404 };
    }
    const type =
      lead.property_type === 'maison' || lead.property_type === 'appartement'
        ? lead.property_type
        : null;
    return {
      lead_id: lead.id,
      address: lead.address,
      postal_code: lead.postal_code,
      city: lead.city,
      ban_id: lead.ban_id,
      latitude: lead.latitude,
      longitude: lead.longitude,
      property_type: type,
      surface_m2: lead.surface_m2,
      rooms: lead.rooms,
      floor: lead.etage,
      dpe_class: lead.dpe_class,
    };
  }
  if (input.bienId) {
    const { data: bien } = await session
      .from('biens')
      .select(
        'id, created_by, assigned_to, address, postal_code, city, ban_id, latitude, longitude, property_type, surface_m2, rooms, dpe_lettre, ges_lettre, dpe_kwh, photos, listing_description, proprietaire_contact_id, lead_id, charges_annuelles',
      )
      .eq('id', input.bienId)
      .eq('agency_id', input.agencyId)
      .maybeSingle();
    if (!bien) return { error: 'Bien introuvable', status: 404 };
    if (
      !canSeeOwnedRecord(input.viewer, {
        assignedTo: bien.assigned_to ?? null,
        createdBy: bien.created_by,
      })
    ) {
      return { error: 'Bien introuvable', status: 404 };
    }
    const type =
      bien.property_type === 'maison' || bien.property_type === 'appartement'
        ? bien.property_type
        : null;
    const photos: EstimationPhoto[] = parsePhotos(
      (bien.photos ?? []).slice(0, 6).map((url: string) => ({ url, kind: 'photo' })),
    );
    const fiche: EstimationBien = {
      ...BIEN_VIDE,
      ges: bien.ges_lettre,
      consoKwh: bien.dpe_kwh,
      chargesAnnuelles: bien.charges_annuelles ?? null,
    };
    return {
      bien_id: bien.id,
      lead_id: bien.lead_id,
      contact_id: bien.proprietaire_contact_id,
      address: bien.address,
      postal_code: bien.postal_code,
      city: bien.city,
      ban_id: bien.ban_id,
      latitude: bien.latitude,
      longitude: bien.longitude,
      property_type: type,
      surface_m2: bien.surface_m2,
      rooms: bien.rooms,
      dpe_class: bien.dpe_lettre,
      commentaires_publics: bien.listing_description,
      photos,
      bien: fiche,
    };
  }
  return null;
}

function estErreurPrefill(
  v: Record<string, unknown> | { error: string; status: number },
): v is { error: string; status: number } {
  return typeof (v as { status?: unknown }).status === 'number' && typeof (v as { error?: unknown }).error === 'string';
}


