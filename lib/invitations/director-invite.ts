import { randomBytes } from 'crypto';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { sendDirectorInvitationEmail } from '@/lib/email/sendInvitationEmail';
import { normalizeInviteEmail } from '@/lib/invitations/validate';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function generateToken(): string {
  return randomBytes(32).toString('hex');
}

export type SendDirectorInviteResult = {
  token: string;
  email: string;
  agencyName: string;
  inviteUrl: string;
};

/** Envoie l'email pour une invitation directeur déjà en base. */
export async function sendDirectorInviteByToken(
  token: string,
): Promise<{ ok: true; result: SendDirectorInviteResult } | { ok: false; error: string; status: number }> {
  const trimmedToken = token.trim();
  if (!trimmedToken) {
    return { ok: false, error: "Token d'invitation manquant.", status: 400 };
  }

  const admin = createSupabaseAdminClient();
  const { data: invitation, error } = await admin
    .from('invitations')
    .select('email, role, agency_name, used_at, expires_at')
    .eq('token', trimmedToken)
    .maybeSingle();

  if (error) {
    return { ok: false, error: error.message, status: 500 };
  }

  if (!invitation) {
    return { ok: false, error: 'Invitation introuvable.', status: 404 };
  }

  if (invitation.role !== 'directeur') {
    return { ok: false, error: "Cette invitation n'est pas une invitation directeur.", status: 400 };
  }

  if (invitation.used_at) {
    return { ok: false, error: 'Invitation déjà acceptée.', status: 409 };
  }

  if (new Date(invitation.expires_at) <= new Date()) {
    return { ok: false, error: 'Invitation expirée.', status: 410 };
  }

  const agencyName = invitation.agency_name?.trim() || 'votre agence';
  const email = normalizeInviteEmail(invitation.email);

  await sendDirectorInvitationEmail({
    to: email,
    token: trimmedToken,
    agencyName,
  });

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() ?? 'https://priimo.fr';
  const inviteUrl = `${siteUrl.replace(/\/$/, '')}/invite?token=${encodeURIComponent(trimmedToken)}`;

  return {
    ok: true,
    result: { token: trimmedToken, email, agencyName, inviteUrl },
  };
}

/** Crée une invitation directeur en base et envoie l'email. */
export async function createAndSendDirectorInvite(input: {
  email: string;
  agencyName: string;
  token?: string;
}): Promise<{ ok: true; result: SendDirectorInviteResult } | { ok: false; error: string; status: number }> {
  const email = normalizeInviteEmail(input.email);
  const agencyName = input.agencyName.trim();

  if (!email || !EMAIL_REGEX.test(email)) {
    return { ok: false, error: 'Adresse email invalide.', status: 400 };
  }

  if (!agencyName) {
    return { ok: false, error: "Le nom de l'agence est obligatoire.", status: 400 };
  }

  const admin = createSupabaseAdminClient();
  const token = input.token?.trim() || generateToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();

  const { data: existingOpen } = await admin
    .from('invitations')
    .select('id, token')
    .eq('email', email)
    .eq('role', 'directeur')
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (existingOpen && existingOpen.token !== token) {
    return {
      ok: false,
      error: 'Une invitation directeur est déjà en cours pour cette adresse. Utilisez /send avec le token existant.',
      status: 409,
    };
  }

  if (!existingOpen) {
    const { error: insertErr } = await admin.from('invitations').insert({
      token,
      email,
      role: 'directeur',
      agency_name: agencyName,
      expires_at: expiresAt,
    });

    if (insertErr) {
      return { ok: false, error: insertErr.message, status: 500 };
    }
  }

  return sendDirectorInviteByToken(token);
}
