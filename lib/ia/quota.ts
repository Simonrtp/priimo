import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { MESSAGE_QUOTA_IA, PLAFONDS_IA_JOUR, quotaIndisponible, type UsageIa } from '@/lib/ia/quota-regles';

/**
 * Réserve un appel à Mistral pour l'agent connecté, sur un compteur en base
 * commun à toutes les instances (les limites en mémoire ne voient que la
 * leur). Laisse passer si la base ne répond pas : un agent sur le terrain ne
 * doit jamais être bloqué par une panne du compteur, les limites en mémoire
 * restent en second rideau.
 */
export async function reserverIa(usage: UsageIa): Promise<boolean> {
  try {
    const supabase = (await createSupabaseServerClient()) as unknown as SupabaseClient;
    const { data, error } = await supabase.rpc('ia_reserver', {
      p_usage: usage,
      p_plafond: PLAFONDS_IA_JOUR[usage],
    });
    if (error) {
      if (!quotaIndisponible(error)) console.error('[ia] quota', usage, error.message);
      return true;
    }
    return data !== false;
  } catch (err) {
    console.error('[ia] quota', usage, err);
    return true;
  }
}

export function reponseQuotaIa(): NextResponse {
  return NextResponse.json({ error: MESSAGE_QUOTA_IA, quotaIa: true }, { status: 429 });
}
