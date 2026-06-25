'use server';

import { randomBytes } from 'crypto';
import { revalidatePath } from 'next/cache';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import type { InvitationInsert } from '@/lib/types/database';
import { buildInviteUrl } from '@/lib/utils/format';

export type CreateInvitationInput = {
  email: string;
  role: 'directeur' | 'collaborateur';
  agencyName: string;
  agencyId?: string;
  validityDays: number;
};

export type CreateInvitationResult =
  | { ok: true; inviteUrl: string; token: string }
  | { ok: false; error: string };

export async function createInvitation(input: CreateInvitationInput): Promise<CreateInvitationResult> {
  const email = input.email.trim().toLowerCase();
  const agencyName = input.agencyName.trim();
  const validityDays = input.validityDays > 0 ? input.validityDays : 7;

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
  const expiresAt = new Date(Date.now() + validityDays * 24 * 3600 * 1000).toISOString();

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

export async function deleteInvitation(id: string): Promise<{ ok: boolean; error?: string }> {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from('invitations').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/invitations');
  return { ok: true };
}
