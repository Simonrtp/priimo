import { NextResponse } from 'next/server';
import {
  agregerUsage,
  formesFrequentes,
  type FormeFrequente,
  type MessageAgrege,
  type UsageRow,
} from '@/lib/admin/assistant-usage';
import { monthlyTokenCap } from '@/lib/assistant/budget';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

/** Fenêtre d'analyse : douze mois suffisent pour répondre « combien me coûte cette agence ». */
const MOIS_ANALYSES = 12;
const MAX_ROWS = 20_000;

export type AdminAssistantUsage = {
  plafondMensuel: number;
  usage: UsageRow[];
  formes: FormeFrequente[];
};

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const admin = createSupabaseAdminClient();
  const depuis = new Date();
  depuis.setUTCMonth(depuis.getUTCMonth() - MOIS_ANALYSES);
  const depuisIso = depuis.toISOString();

  const [agencies, conversations, messages, queries] = await Promise.all([
    admin.from('agencies').select('id, name'),
    admin.from('assistant_conversations').select('id, agency_id'),
    admin
      .from('assistant_messages')
      .select('conversation_id, tokens, created_at')
      .gte('created_at', depuisIso)
      .limit(MAX_ROWS),
    admin
      .from('assistant_queries')
      .select('question, lignes_count')
      .gte('created_at', depuisIso)
      .limit(MAX_ROWS),
  ]);

  const noms = new Map<string, string>();
  for (const a of agencies.data ?? []) noms.set(a.id, a.name);

  const agenceDuFil = new Map<string, string>();
  for (const c of conversations.data ?? []) agenceDuFil.set(c.id, c.agency_id);

  const agreges: MessageAgrege[] = [];
  for (const m of messages.data ?? []) {
    const agencyId = agenceDuFil.get(m.conversation_id);
    if (!agencyId) continue;
    agreges.push({
      agencyId,
      conversationId: m.conversation_id,
      createdAt: m.created_at,
      tokens: m.tokens ?? 0,
    });
  }

  const payload: AdminAssistantUsage = {
    plafondMensuel: monthlyTokenCap(),
    usage: agregerUsage(agreges, noms),
    formes: formesFrequentes(
      (queries.data ?? []).map((q) => ({
        question: q.question,
        lignesCount: q.lignes_count ?? 0,
      })),
    ),
  };

  return NextResponse.json(payload);
}
