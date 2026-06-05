import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

type Client = SupabaseClient<Database>;

/** Première visite dashboard : initialise sans bandeau. */
export async function initializeLeadsLastSeenAt(supabase: Client, profileId: string): Promise<string> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('profiles')
    .update({ leads_last_seen_at: now })
    .eq('id', profileId);
  if (error) {
    throw new Error(`Impossible d'initialiser la dernière visite : ${error.message}`);
  }
  return now;
}

/** Fermeture bandeau ou « Voir les nouveaux ». */
export async function markLeadsAsSeen(supabase: Client, profileId: string): Promise<string> {
  return initializeLeadsLastSeenAt(supabase, profileId);
}
