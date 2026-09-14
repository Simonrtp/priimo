import type { User } from '@supabase/supabase-js';
import { normalizeFrenchPhone, validateInviteFields } from '@/lib/invite-account';
import { normalizeInviteEmail } from '@/lib/invitations/validate';
import {
  parsePostalCodesFromBody,
  validateAgencyPostalCodes,
} from '@/lib/agency-postal-codes';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getAdminEmail } from '@/lib/auth/requireAdmin';
import { sendInscriptionNotificationToAdmin } from '@/lib/email/sendInscriptionEmail';

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export type InscriptionInput = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
  agencyName: string;
  address: string;
  latitude: number;
  longitude: number;
  codesPostaux: unknown;
  acceptedCgu: boolean;
};

export type InscriptionResult =
  | { ok: true; userId: string; agencyId: string }
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

async function findAuthUserByEmail(admin: Admin, email: string): Promise<User | null> {
  const target = email.trim().toLowerCase();
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) return null;
    const hit = data.users.find((u) => (u.email ?? '').toLowerCase() === target);
    if (hit) return hit;
    if (data.users.length < 200) break;
  }
  return null;
}

export async function creerInscription(input: InscriptionInput): Promise<InscriptionResult> {
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
    { requireAgencyName: true },
  );
  if (validationError) return { ok: false, status: 400, error: validationError };

  const address = input.address.trim();
  if (address.length < 5) return { ok: false, status: 400, error: 'Adresse invalide.' };
  if (
    !Number.isFinite(input.latitude) ||
    !Number.isFinite(input.longitude) ||
    (input.latitude === 0 && input.longitude === 0)
  ) {
    return { ok: false, status: 400, error: 'Sélectionnez une adresse dans la liste.' };
  }

  const codes = parsePostalCodesFromBody(input.codesPostaux);
  if (!codes) return { ok: false, status: 400, error: 'Codes postaux invalides.' };
  const postalError = validateAgencyPostalCodes(codes);
  if (postalError) return { ok: false, status: 400, error: postalError };

  const email = normalizeInviteEmail(input.email);
  const phone = normalizeFrenchPhone(input.phone);
  const admin = createSupabaseAdminClient();

  const existing = await findAuthUserByEmail(admin, email);
  if (existing) {
    return {
      ok: false,
      status: 409,
      error: 'Un compte existe déjà avec cet email. Connectez-vous.',
    };
  }

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
  });
  if (authError || !authData.user) {
    const msg = authError?.message ?? '';
    if (isEmailAlreadyRegistered(msg)) {
      return { ok: false, status: 409, error: 'Un compte existe déjà avec cet email. Connectez-vous.' };
    }
    if (/password/i.test(msg)) {
      return { ok: false, status: 400, error: 'Mot de passe refusé. Au moins 8 caractères.' };
    }
    return { ok: false, status: 500, error: 'Impossible de créer le compte.' };
  }
  const userId = authData.user.id;
  const createdAuth = true;

  const rollback = async (agencyId?: string) => {
    if (agencyId) await admin.from('agencies').delete().eq('id', agencyId);
    if (createdAuth) await admin.auth.admin.deleteUser(userId);
  };

  const { data: agency, error: agencyErr } = await admin
    .from('agencies')
    .insert({
      name: input.agencyName.trim(),
      address,
      phone,
      email,
      latitude: input.latitude,
      longitude: input.longitude,
      codes_postaux: codes,
      plan: 'standard',
      statut_abonnement: 'en_attente',
      demande_decision: 'en_attente',
    })
    .select('id')
    .single();

  if (agencyErr || !agency) {
    await rollback();
    console.error('[inscription] agency', agencyErr);
    return { ok: false, status: 500, error: "Impossible de créer l'agence." };
  }

  const { data: existingProfile } = await admin.from('profiles').select('id').eq('id', userId).maybeSingle();
  if (!existingProfile) {
    const { error: profileErr } = await admin.from('profiles').insert({
      id: userId,
      first_name: input.firstName.trim(),
      last_name: input.lastName.trim(),
      phone,
    });
    if (profileErr) {
      await rollback(agency.id);
      console.error('[inscription] profile', profileErr);
      return { ok: false, status: 500, error: 'Impossible de créer le profil.' };
    }
  } else {
    const { error: profileUpd } = await admin
      .from('profiles')
      .update({
        first_name: input.firstName.trim(),
        last_name: input.lastName.trim(),
        phone,
      })
      .eq('id', userId);
    if (profileUpd) {
      await rollback(agency.id);
      console.error('[inscription] profile update', profileUpd);
      return { ok: false, status: 500, error: 'Impossible de créer le profil.' };
    }
  }

  const { error: memberErr } = await admin.from('profile_agencies').insert({
    profile_id: userId,
    agency_id: agency.id,
    role: 'directeur',
  });
  if (memberErr) {
    await rollback(agency.id);
    console.error('[inscription] membership', memberErr);
    return { ok: false, status: 500, error: "Impossible de rattacher l'agence." };
  }

  const { error: activeErr } = await admin
    .from('profiles')
    .update({ active_agency_id: agency.id })
    .eq('id', userId);
  if (activeErr) {
    await rollback(agency.id);
    console.error('[inscription] active agency', activeErr);
    return { ok: false, status: 500, error: "Impossible de rattacher l'agence." };
  }

  if (getAdminEmail()) {
    void sendInscriptionNotificationToAdmin({
      prenom: input.firstName.trim(),
      nom: input.lastName.trim(),
      email,
      telephone: phone,
      agencyName: input.agencyName.trim(),
      address,
      codesPostaux: codes,
    }).catch((err) => console.error('[inscription] mail admin', err));
  }

  return { ok: true, userId, agencyId: agency.id };
}
