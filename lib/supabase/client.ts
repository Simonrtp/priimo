import { createBrowserClient } from '@supabase/auth-helpers-nextjs';
import { getSupabaseAnonKey, getSupabaseUrl } from '@/lib/supabase/env';

export function createSupabaseBrowserClient() {
  return createBrowserClient(getSupabaseUrl(), getSupabaseAnonKey());
}
