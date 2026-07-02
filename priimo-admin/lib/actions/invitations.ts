'use server';

import { randomBytes } from 'crypto';
import { revalidatePath } from 'next/cache';
import {
  sendCollaboratorInvitationEmail,
  sendDirectorInvitationEmail,
} from '@/lib/email/invitation-email';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import type { InvitationInsert, InvitationRow, ProfileRow } from '@/lib/types/database';
import { buildInviteUrl } from '@/lib/utils/format';

/** Durée de validité par défaut des invitations créées depuis l'admin (6 mois). */
const INVITATION_VALIDITY_DAYS = 180;

export type CreateInvitationInput = {
  email: string;
  role: 'directeur' | 'collaborateur';
  agencyName: string;
  agencyId?: string;
};

export type CreateInvitationResult =
  | { ok: true; inviteUrl: string; token: string }
  | { ok: false; error: string };

export async function createInvitation(input: CreateInvitationInput): Promise<CreateInvitationResult> {
  const email = input.email.trim().toLowerCase();
  const agencyName = input.agencyName.trim();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: 'Adresse email invalide.' };
  }

  if (input.role === 'directeur' && !agencyName) {
    return { ok: false, error: "Le nom d'agence est obligatoire pour un directeur." };
  }

  if (input.role === 'collaborateur' && !input.agencyId) {
    return { ok: false, error: "Sélectionnez l'agence de rattachement pour un collaborateur." };
  }

  const admin = createSupabaseAdminClient();
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(
    Date.now() + INVITATION_VALIDITY_DAYS * 24 * 3600 * 1000,
  ).toISOString();

  const row: InvitationInsert =
    input.role === 'directeur'
      ? {
          token,
          email,
          role: 'directeur',
          agency_id: null,
          agency_name: agencyName,
          expires_at: expiresAt,
        }
      : {
          token,
          email,
          role: 'collaborateur',
          agency_id: input.agencyId!,
          agency_name: agencyName || null,
          expires_at: expiresAt,
        };

  const { error } = await admin.from('invitations').insert(row);
  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath('/invitations');
  return { ok: true, inviteUrl: buildInviteUrl(token), token };
}

export type ResendInvitationResult = { ok: true; email: string } | { ok: false; error: string };

/**
 * Renvoie l'email d'invitation d'origine (même template, même lien/token).
 * Si l'invitation a expiré entre-temps, sa validité est prolongée pour que
 * le lien renvoyé fonctionne.
 */
export async function resendInvitationEmail(id: string): Promise<ResendInvitationResult> {
  const admin = createSupabaseAdminClient();

  const { data, error } = await admin.from('invitations').select('*').eq('id', id).maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: 'Invitation introuvable.' };

  const invitation = data as InvitationRow;

  if (invitation.used_at) {
    return { ok: false, error: 'Cette invitation a déjà été utilisée : rien à relancer.' };
  }

  // Prolonge les invitations expirées pour que le lien du mail reste valable.
  if (new Date(invitation.expires_at) <= new Date()) {
    const newExpiresAt = new Date(
      Date.now() + INVITATION_VALIDITY_DAYS * 24 * 3600 * 1000,
    ).toISOString();
    const { error: extendError } = await admin
      .from('invitations')
      .update({ expires_at: newExpiresAt })
      .eq('id', id);
    if (extendError) {
      return { ok: false, error: `Prolongation impossible : ${extendError.message}` };
    }
  }

  try {
    if (invitation.role === 'directeur') {
      await sendDirectorInvitationEmail({
        to: invitation.email,
        token: invitation.token,
        agencyName: invitation.agency_name ?? 'votre agence',
      });
    } else {
      // Le mail collaborateur mentionne le directeur de l'agence : on le retrouve.
      let directorFullName: string | null = null;
      let agencyName = invitation.agency_name;

      if (invitation.agency_id) {
        const [directorRes, agencyRes] = await Promise.all([
          admin
            .from('profiles')
            .select('first_name, last_name')
            .eq('agency_id', invitation.agency_id)
            .eq('role', 'directeur')
            .limit(1)
            .maybeSingle(),
          agencyName
            ? Promise.resolve(null)
            : admin.from('agencies').select('name').eq('id', invitation.agency_id).maybeSingle(),
        ]);

        const director = directorRes.data as Pick<ProfileRow, 'first_name' | 'last_name'> | null;
        if (director) {
          directorFullName = `${director.first_name} ${director.last_name}`.trim() || null;
        }
        if (!agencyName && agencyRes?.data) {
          agencyName = (agencyRes.data as { name: string }).name;
        }
      }

      await sendCollaboratorInvitationEmail({
        to: invitation.email,
        token: invitation.token,
        agencyName: agencyName ?? 'votre agence',
        directorFullName,
      });
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Échec de l'envoi de l'email." };
  }

  revalidatePath('/invitations');
  return { ok: true, email: invitation.email };
}

export async function deleteInvitation(id: string): Promise<{ ok: boolean; error?: string }> {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from('invitations').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/invitations');
  return { ok: true };
}
