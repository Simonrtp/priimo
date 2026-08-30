import type { User } from '@supabase/supabase-js';
import {
  getValidInvitationByToken,
  normalizeInviteEmail,
} from '@/lib/invitations/validate';
import { normalizeFrenchPhone, validateInviteFields } from '@/lib/invite-account';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import type { InvitationRole } from '@/types/database';

type Admin = ReturnType<typeof createSupabaseAdminClient>;

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

function isEmailAlreadyRegistered(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes('already') ||
    m.includes('registered') ||
    m.includes('exists') ||
    m.includes('duplicate') ||
    m.includes('user_repeated')
  );
}

/** Recherche Auth par email (pagination — listUsers n’a pas de filtre email fiable partout). */
async function findAuthUserByEmail(admin: Admin, email: string): Promise<User | null> {
  const target = email.trim().toLowerCase();
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) {
      console.error('[provision] listUsers', error);
      return null;
    }
    const hit = data.users.find((u) => (u.email ?? '').toLowerCase() === target);
    if (hit) return hit;
    if (data.users.length < 200) break;
  }
  return null;
}

/**
 * Provisionne un compte via invitation (directeur ou collaborateur).
 *
 * Cas fréquent après « suppression » d’un collab : le profil / membership part,
 * mais auth.users reste → createUser échoue. On répare : maj mot de passe +
 * recréation profil + rattachement agence (token d’invitation = preuve).
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

  let userId: string;
  let isNewAuthUser = false;

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: normalizedEmail,
    password: input.password,
    email_confirm: true,
  });

  if (!authError && authData.user) {
    userId = authData.user.id;
    isNewAuthUser = true;
  } else {
    const msg = authError?.message ?? '';
    console.error('[provision] createUser', authError);

    const existing =
      (isEmailAlreadyRegistered(msg) ? await findAuthUserByEmail(supabaseAdmin, normalizedEmail) : null) ??
      (await findAuthUserByEmail(supabaseAdmin, normalizedEmail));

    if (!existing) {
      if (/password/i.test(msg)) {
        return {
          ok: false,
          status: 400,
          error: 'Mot de passe refusé. Choisissez-en un d’au moins 8 caractères.',
        };
      }
      return {
        ok: false,
        status: 500,
        error: msg
          ? `Impossible de créer le compte (${msg}).`
          : 'Impossible de créer le compte.',
      };
    }

    // Compte Auth orphelin ou réinvitation : on réutilise l’id existant.
    if (input.expectedRole === 'directeur') {
      const { data: anyMembership } = await supabaseAdmin
        .from('profile_agencies')
        .select('agency_id')
        .eq('profile_id', existing.id)
        .limit(1);
      if (anyMembership && anyMembership.length > 0) {
        return {
          ok: false,
          status: 409,
          error:
            'Un compte existe déjà avec cet email. Connectez-vous, ou utilisez une autre adresse.',
        };
      }
    }

    const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(existing.id, {
      password: input.password,
      email_confirm: true,
    });
    if (updateErr) {
      console.error('[provision] updateUserById', updateErr);
      return {
        ok: false,
        status: 500,
        error: 'Impossible de réactiver le compte existant. Réessayez ou contactez le support.',
      };
    }

    userId = existing.id;
    isNewAuthUser = false;
  }

  let agencyId = invitation.agency_id;
  let createdAgency = false;

  const rollbackNewUser = async () => {
    if (!isNewAuthUser) return;
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
        await rollbackNewUser();
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
        await rollbackNewUser();
        console.error('[provision] agency', agencyError);
        return { ok: false, status: 500, error: "Impossible de créer l'agence." };
      }
      agencyId = newAgency.id;
      createdAgency = true;
    }
  }

  if (!agencyId) {
    await rollbackNewUser();
    return { ok: false, status: 400, error: 'Invitation invalide ou expirée' };
  }

  const { data: existingMembership } = await supabaseAdmin
    .from('profile_agencies')
    .select('agency_id')
    .eq('profile_id', userId)
    .eq('agency_id', agencyId)
    .maybeSingle();
  if (existingMembership) {
    await rollbackNewUser();
    return {
      ok: false,
      status: 409,
      error: 'Vous faites déjà partie de cette agence. Connectez-vous.',
    };
  }

  const { data: existingProfile } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle();

  if (!existingProfile) {
    const { error: profileError } = await supabaseAdmin.from('profiles').insert({
      id: userId,
      first_name: input.firstName.trim(),
      last_name: input.lastName.trim(),
      phone: normalizedPhone,
    });
    if (profileError) {
      await rollbackNewUser();
      console.error('[provision] profile', profileError);
      return {
        ok: false,
        status: 500,
        error: `Impossible de créer le profil (${profileError.message}).`,
      };
    }
  } else {
    await supabaseAdmin
      .from('profiles')
      .update({
        first_name: input.firstName.trim(),
        last_name: input.lastName.trim(),
        phone: normalizedPhone,
      })
      .eq('id', userId);
  }

  const { error: membershipError } = await supabaseAdmin.from('profile_agencies').insert({
    profile_id: userId,
    agency_id: agencyId,
    role: input.expectedRole,
  });
  if (membershipError) {
    await rollbackNewUser();
    console.error('[provision] membership', membershipError);
    return {
      ok: false,
      status: 500,
      error: `Impossible de rattacher l'agence (${membershipError.message}).`,
    };
  }

  const { error: activeAgencyError } = await supabaseAdmin
    .from('profiles')
    .update({ active_agency_id: agencyId })
    .eq('id', userId);
  if (activeAgencyError) {
    await rollbackNewUser();
    console.error('[provision] active agency', activeAgencyError);
    return { ok: false, status: 500, error: "Impossible d'activer l'agence." };
  }

  await supabaseAdmin
    .from('invitations')
    .update({ used_at: new Date().toISOString() })
    .eq('token', input.token.trim());

  return { ok: true, userId, role: input.expectedRole };
}
