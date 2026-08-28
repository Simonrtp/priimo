/**
 * Accès aux fils de conversation. Toutes les lectures passent par le client
 * de session : la RLS restreint déjà à l'auteur, on ne s'appuie jamais sur un
 * identifiant venu du client pour décider de la visibilité.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { AssistantSource } from '@/lib/assistant/collecte';
import { titreDepuisQuestion } from '@/lib/assistant/conversation';
import { normalizeTexte } from '@/lib/assistant/normalize';
import type { Database } from '@/types/database';

type Client = SupabaseClient<Database>;

export const CONVERSATIONS_PAGE = 40;
export const MESSAGES_MAX = 200;

export type ConversationResume = {
  id: string;
  titre: string;
  createdAt: string;
  updatedAt: string;
};

export type ConversationMessageRow = {
  id: string;
  role: 'user' | 'assistant';
  contenu: string;
  sources: AssistantSource[];
  createdAt: string;
};

function asSources(raw: unknown): AssistantSource[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((s): s is AssistantSource => Boolean(s) && typeof s === 'object');
}

export async function listerConversations(
  supabase: Client,
  profileId: string,
  recherche = '',
): Promise<ConversationResume[]> {
  const { data, error } = await supabase
    .from('assistant_conversations')
    .select('id, titre, created_at, updated_at')
    .eq('profile_id', profileId)
    .order('updated_at', { ascending: false })
    .limit(CONVERSATIONS_PAGE * 3);

  if (error || !data) {
    if (error) console.error('[assistant] listerConversations', error.message);
    return [];
  }

  const rows = data.map((row) => ({
    id: row.id,
    titre: row.titre || 'Conversation',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

  // Recherche plein texte côté serveur, sur le titre normalisé : accents et
  // casse ne doivent pas faire rater une conversation.
  const q = normalizeTexte(recherche);
  const filtered = q
    ? rows.filter((r) => normalizeTexte(r.titre).includes(q))
    : rows;
  return filtered.slice(0, CONVERSATIONS_PAGE);
}

export async function lireMessages(
  supabase: Client,
  conversationId: string,
): Promise<ConversationMessageRow[]> {
  const { data, error } = await supabase
    .from('assistant_messages')
    .select('id, role, contenu, lignes_sources, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(MESSAGES_MAX);

  if (error || !data) {
    if (error) console.error('[assistant] lireMessages', error.message);
    return [];
  }
  return data.map((row) => ({
    id: row.id,
    role: row.role,
    contenu: row.contenu,
    sources: asSources(row.lignes_sources),
    createdAt: row.created_at,
  }));
}

export type ConversationEtat = {
  id: string;
  resume: string | null;
  messages: Array<{ role: 'user' | 'assistant'; contenu: string }>;
  total: number;
};

/** Fil courant + résumé roulant. Rend null si le fil n'appartient pas au lecteur. */
export async function chargerConversation(
  supabase: Client,
  conversationId: string,
  profileId: string,
): Promise<ConversationEtat | null> {
  const { data, error } = await supabase
    .from('assistant_conversations')
    .select('id, resume, profile_id')
    .eq('id', conversationId)
    .maybeSingle();

  if (error || !data || data.profile_id !== profileId) return null;

  const messages = await lireMessages(supabase, conversationId);
  return {
    id: data.id,
    resume: data.resume,
    messages: messages.map((m) => ({ role: m.role, contenu: m.contenu })),
    total: messages.length,
  };
}

export async function creerConversation(
  supabase: Client,
  input: { agencyId: string; profileId: string; premiereQuestion: string },
): Promise<string | null> {
  const { data, error } = await supabase
    .from('assistant_conversations')
    .insert({
      agency_id: input.agencyId,
      profile_id: input.profileId,
      titre: titreDepuisQuestion(input.premiereQuestion),
    })
    .select('id')
    .single();

  if (error || !data) {
    console.error('[assistant] creerConversation', error?.message);
    return null;
  }
  return data.id;
}

export async function ajouterMessage(
  supabase: Client,
  input: {
    conversationId: string;
    role: 'user' | 'assistant';
    contenu: string;
    sources?: readonly AssistantSource[];
    tokens?: number;
  },
): Promise<void> {
  const { error } = await supabase.from('assistant_messages').insert({
    conversation_id: input.conversationId,
    role: input.role,
    contenu: input.contenu,
    lignes_sources: input.sources ?? [],
    tokens: Math.max(0, Math.round(input.tokens ?? 0)),
  });
  if (error) console.error('[assistant] ajouterMessage', error.message);
}

export async function toucherConversation(
  supabase: Client,
  conversationId: string,
  resume?: string | null,
): Promise<void> {
  const patch: { updated_at: string; resume?: string | null } = {
    updated_at: new Date().toISOString(),
  };
  if (resume !== undefined) patch.resume = resume;
  const { error } = await supabase
    .from('assistant_conversations')
    .update(patch)
    .eq('id', conversationId);
  if (error) console.error('[assistant] toucherConversation', error.message);
}

export async function supprimerConversation(
  supabase: Client,
  conversationId: string,
  profileId: string,
): Promise<boolean> {
  const { error } = await supabase
    .from('assistant_conversations')
    .delete()
    .eq('id', conversationId)
    .eq('profile_id', profileId);
  if (error) {
    console.error('[assistant] supprimerConversation', error.message);
    return false;
  }
  return true;
}
