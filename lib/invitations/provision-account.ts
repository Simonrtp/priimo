import {
  getValidInvitationByToken,
  normalizeInviteEmail,
} from '@/lib/invitations/validate';
import { normalizeFrenchPhone, validateInviteFields } from '@/lib/invite-account';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import type { InvitationRole } from '@/types/database';

type ProvisionInput = {
  token: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone: string;
  acceptedCgu: boolean;
  agencyName?: string;
  expectedRole: InvitationRole;
};

export type ProvisionResult =
  | { ok: true; userId: string; role: InvitationRole }
  | { ok: false; status: number; error: string };

/**
 * Provisionne un compte via invitation (directeur ou collaborateur).
 * Partagé par /api/create-director et /api/create-collaborator.
 */
export async function provisionInviteAccount(input: ProvisionInput): Promise<ProvisionResult> {
  const requireAgencyName = input.expectedRole === 'directeur';
  const validationError = validateInviteFields(
    {
      agencyName: input.agencyName,
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      password: input.password,
      phone: input.phone,
      acceptedCgu: input.acceptedCgu,
    },
    { requireAgencyName },
  );
  if (validationError) {
    return { ok: false, status: 400, error: validationError };
  }

  const normalizedEmail = normalizeInviteEmail(input.email);
  const normalizedPhone = normalizeFrenchPhone(input.phone);
  const supabaseAdmin = createSupabaseAdminClient();

  const { invitation, error: inviteLookupError } = await getValidInvitationByToken(input.token);
  if (!invitation || invitation.role !== input.expectedRole) {
    return {
      ok: false,
      status: 400,
      error: inviteLookupError ?? 'Invitation invalide ou expirée',
    };
  }

  if (input.expectedRole === 'collaborateur' && !invitation.agency_id) {
    return { ok: false, status: 400, error: 'Invitation invalide ou expirée' };
  }

  if (normalizedEmail !== invitation.email) {
    return {
      ok: false,
      status: 400,
      error: "L'email ne correspond pas à celui de l'invitation.",
    };
  }

  const resolvedAgencyName =
    (input.agencyName ?? '').trim() || invitation.agency_name || '';
  if (requireAgencyName && !resolvedAgencyName) {
    return { ok: false, status: 400, error: "Le nom de l'agence est obligatoire." };
  }

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: normalizedEmail,
    password: input.password,
    email_confirm: true,
  });

  if (authError || !authData.user) {
    console.error('[provision] createUser', authError);
    return { ok: false, status: 500, error: 'Impossible de créer le compte.' };
  }

  const userId = authData.user.id;
  let agencyId = invitation.agency_id;
  let createdAgency = false;

  const rollback = async () => {
    await supabaseAdmin.auth.admin.deleteUser(userId);
    if (createdAgency && agencyId) {
      await supabaseAdmin.from('agencies').delete().eq('id', agencyId);
    }
  };

  if (input.expectedRole === 'directeur') {
    if (invitation.agency_id) {
      const { data: existingAgency, error: loadAgencyErr } = await supabaseAdmin
        .from('agencies')
        .select('id')
        .eq('id', invitation.agency_id)
        .maybeSingle();
      if (loadAgencyErr || !existingAgency) {
        await rollback();
        return { ok: false, status: 400, error: "Agence liée à l'invitation introuvable." };
      }
      agencyId = existingAgency.id;
    } else {
      const { data: newAgency, error: agencyError } = await supabaseAdmin
        .from('agencies')
        .insert({
          name: resolvedAgencyName,
          phone: normalizedPhone,
          email: normalizedEmail,
          plan: 'fondateur',
        })
        .select('id')
        .single();
      if (agencyError || !newAgency) {
        await rollback();
        console.error('[provision] agency', agencyError);
        return { ok: false, status: 500, error: "Impossible de créer l'agence." };
      }
      agencyId = newAgency.id;
      createdAgency = true;
    }
  }

  if (!agencyId) {
    await rollback();
    return { ok: false, status: 400, error: 'Invitation invalide ou expirée' };
  }

  const { error: profileError } = await supabaseAdmin.from('profiles').insert({
    id: userId,
    first_name: input.firstName.trim(),
    last_name: input.lastName.trim(),
    phone: normalizedPhone,
  });
  if (profileError) {
    await rollback();
    console.error('[provision] profile', profileError);
    return { ok: false, status: 500, error: 'Impossible de créer le profil.' };
  }

  const { error: membershipError } = await supabaseAdmin.from('profile_agencies').insert({
    profile_id: userId,
    agency_id: agencyId,
    role: input.expectedRole,
  });
  if (membershipError) {
    await rollback();
    console.error('[provision] membership', membershipError);
    return { ok: false, status: 500, error: "Impossible de rattacher l'agence." };
  }

  const { error: activeAgencyError } = await supabaseAdmin
    .from('profiles')
    .update({ active_agency_id: agencyId })
    .eq('id', userId);
  if (activeAgencyError) {
    await rollback();
    console.error('[provision] active agency', activeAgencyError);
    return { ok: false, status: 500, error: "Impossible d'activer l'agence." };
  }

  await supabaseAdmin
    .from('invitations')
    .update({ used_at: new Date().toISOString() })
    .eq('token', input.token.trim());

  return { ok: true, userId, role: input.expectedRole };
}
