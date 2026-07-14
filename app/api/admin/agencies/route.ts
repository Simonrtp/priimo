import { randomBytes } from 'crypto';
import { NextResponse } from 'next/server';
import {
  parsePostalCodesFromBody,
  validateAgencyPostalCodes,
} from '@/lib/agency-postal-codes';
import { findPostalCollisions } from '@/lib/admin/postal-collisions';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { sendAgencyActivatedEmail } from '@/lib/email/sendAgencyRequestEmail';
import { sendDirectorInvitationEmail } from '@/lib/email/sendInvitationEmail';
import { normalizeInviteEmail } from '@/lib/invitations/validate';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import type { PlanCode } from '@/types/database';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_PLANS: PlanCode[] = ['fondateur', 'standard'];

function parseCoordinates(body: Record<string, unknown>) {
  const latitude = Number(body.latitude);
  const longitude = Number(body.longitude);
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    (latitude === 0 && longitude === 0)
  ) {
    return null;
  }
  return { latitude, longitude };
}

export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 });
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) {
    return NextResponse.json({ error: "Le nom de l'agence est requis." }, { status: 400 });
  }

  const address = typeof body.address === 'string' ? body.address.trim() : '';
  if (!address || address.length < 5) {
    return NextResponse.json({ error: 'Adresse invalide.' }, { status: 400 });
  }

  const coords = parseCoordinates(body);
  if (!coords) {
    return NextResponse.json({ error: 'Coordonnées manquantes — géocodez via BAN.' }, { status: 400 });
  }

  const codesPostaux = parsePostalCodesFromBody(body.codesPostaux);
  if (!codesPostaux) {
    return NextResponse.json({ error: 'Codes postaux invalides.' }, { status: 400 });
  }
  const postalError = validateAgencyPostalCodes(codesPostaux);
  if (postalError) {
    return NextResponse.json({ error: postalError }, { status: 400 });
  }

  const planRaw = typeof body.plan === 'string' ? body.plan : 'fondateur';
  if (!ALLOWED_PLANS.includes(planRaw as PlanCode)) {
    return NextResponse.json({ error: 'Plan invalide.' }, { status: 400 });
  }
  const plan = planRaw as PlanCode;

  const directorMode = body.directorMode === 'invite' ? 'invite' : 'existing';
  const existingDirectorId =
    typeof body.existingDirectorId === 'string' ? body.existingDirectorId.trim() : '';
  const inviteEmail =
    typeof body.inviteEmail === 'string' ? normalizeInviteEmail(body.inviteEmail) : '';

  if (directorMode === 'existing' && !existingDirectorId) {
    return NextResponse.json({ error: 'Sélectionnez un directeur.' }, { status: 400 });
  }
  if (directorMode === 'invite') {
    if (!inviteEmail || !EMAIL_REGEX.test(inviteEmail)) {
      return NextResponse.json({ error: 'Email du nouveau directeur invalide.' }, { status: 400 });
    }
  }

  const requestId = typeof body.requestId === 'string' ? body.requestId.trim() : null;

  const admin = createSupabaseAdminClient();

  const { data: agency, error: agencyError } = await admin
    .from('agencies')
    .insert({
      name,
      address,
      latitude: coords.latitude,
      longitude: coords.longitude,
      codes_postaux: codesPostaux,
      plan,
    })
    .select()
    .single();

  if (agencyError || !agency) {
    return NextResponse.json(
      { error: agencyError?.message ?? 'Erreur création agence' },
      { status: 500 },
    );
  }

  try {
    if (directorMode === 'existing') {
      const { data: membership } = await admin
        .from('profile_agencies')
        .select('role')
        .eq('profile_id', existingDirectorId)
        .eq('role', 'directeur')
        .limit(1)
        .maybeSingle();

      if (!membership) {
        throw new Error('Directeur introuvable.');
      }

      const { error: linkErr } = await admin.from('profile_agencies').insert({
        profile_id: existingDirectorId,
        agency_id: agency.id,
        role: 'directeur',
      });
      if (linkErr) throw new Error(linkErr.message);

      const { data: profile } = await admin
        .from('profiles')
        .select('first_name, active_agency_id')
        .eq('id', existingDirectorId)
        .single();

      const { data: authUser } = await admin.auth.admin.getUserById(existingDirectorId);
      const email = authUser.user?.email;
      if (email && profile) {
        await sendAgencyActivatedEmail({
          to: email,
          directorFirstName: profile.first_name,
          agencyName: name,
        });
      }
    } else {
      const token = randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();

      const { error: invErr } = await admin.from('invitations').insert({
        token,
        email: inviteEmail,
        role: 'directeur',
        agency_id: agency.id,
        agency_name: name,
        expires_at: expiresAt,
      });
      if (invErr) throw new Error(invErr.message);

      await sendDirectorInvitationEmail({ to: inviteEmail, token, agencyName: name });
    }

    if (requestId) {
      await admin
        .from('agency_requests')
        .update({ status: 'acceptee', handled_at: new Date().toISOString() })
        .eq('id', requestId);
    }

    return NextResponse.json({ success: true, agencyId: agency.id });
  } catch (e) {
    await admin.from('agencies').delete().eq('id', agency.id);
    const message = e instanceof Error ? e.message : 'Erreur rattachement';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** GET collisions helper for admin UI (same as postal-collisions route). */
export async function GET(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const url = new URL(request.url);
  const raw = url.searchParams.get('codes') ?? '';
  const codes = raw.split(',').map((c) => c.trim()).filter(Boolean);

  const admin = createSupabaseAdminClient();
  const { data: agencies } = await admin.from('agencies').select('id, name, codes_postaux');
  const collisions = findPostalCollisions(codes, agencies ?? []);
  return NextResponse.json({ collisions });
}
