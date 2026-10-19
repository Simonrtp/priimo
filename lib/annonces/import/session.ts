import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getServerUser } from '@/lib/auth/getServerUser';
import { estEnAttente } from '@/lib/billing/acces';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { Qui } from './serveur';

/** Agent connecté + clients : service role pour écrire, session (RLS) pour le reste. */
export async function sessionImport(): Promise<{ qui: Qui; admin: SupabaseClient; db: SupabaseClient } | null> {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) return null;
  return {
    qui: {
      agencyId: agency.id,
      profileId: profile.id,
      codesPostaux: agency.codes_postaux ?? [],
      pagesAutorisees: !estEnAttente(agency),
    },
    admin: createSupabaseAdminClient() as unknown as SupabaseClient,
    db: (await createSupabaseServerClient()) as unknown as SupabaseClient,
  };
}
