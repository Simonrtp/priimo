import { createClient } from '@supabase/supabase-js';
import { getSupabaseServiceRoleKey, getSupabaseUrl } from '@/lib/supabase/env';
import type { Database } from '@/lib/types/database';

/**
 * Client Supabase admin (service_role) — contourne le RLS.
 * NE JAMAIS importer ce module depuis un composant client.
 */
export function createSupabaseAdminClient() {
  return createClient<Database>(getSupabaseUrl(), getSupabaseServiceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
