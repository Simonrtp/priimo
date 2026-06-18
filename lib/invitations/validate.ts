import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export type ValidInvitation = {
  role: 'directeur' | 'collaborateur';
  email: string;
  agency_name: string | null;
  agency_id: string | null;
};

/** Charge une invitation ouverte (non utilisée, non expirée) par token. */
export async function getValidInvitationByToken(
  token: string,
): Promise<{ invitation: ValidInvitation | null; error: string | null }> {
  const trimmed = token.trim();
  if (!trimmed) {
    return { invitation: null, error: "Token d'invitation manquant" };
  }

  const supabaseAdmin = createSupabaseAdminClient();
  const { data, error } = await supabaseAdmin
    .from('invitations')
    .select('role, email, agency_name, agency_id')
    .eq('token', trimmed)
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (error) {
    return { invitation: null, error: 'Erreur lors de la validation du token' };
  }

  if (!data) {
    return { invitation: null, error: 'Invitation invalide ou expirée' };
  }

  if (data.role === 'collaborateur' && !data.agency_id) {
    return { invitation: null, error: 'Invitation invalide ou expirée' };
  }

  return {
    invitation: {
      role: data.role as ValidInvitation['role'],
      email: data.email.trim().toLowerCase(),
      agency_name: data.agency_name?.trim() || null,
      agency_id: data.agency_id ?? null,
    },
    error: null,
  };
}

export function normalizeInviteEmail(email: string): string {
  return email.trim().toLowerCase();
}
