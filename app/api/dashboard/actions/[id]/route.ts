import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { lireAction, resoudreAction } from '@/lib/queries/actions';
import type { CompteRendu } from '@/lib/automations/compte-rendu';
import { sendCompteRenduMandat } from '@/lib/email/compte-rendu-mandat';

/**
 * Résolution d'une proposition.
 *
 * C'est ici, et nulle part ailleurs, qu'une automatisation peut produire un
 * effet vers l'extérieur — et seulement après un clic humain. L'ordre compte :
 * on réserve d'abord la proposition en base (transition atomique depuis
 * `proposee`), puis on envoie. Deux onglets ouverts ne peuvent donc pas
 * produire deux emails au même vendeur.
 */

export const runtime = 'nodejs';

type Decision = 'valider' | 'ignorer';

function parseDecision(value: unknown): Decision | null {
  return value === 'valider' || value === 'ignorer' ? value : null;
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: 'Proposition inconnue' }, { status: 400 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
  }

  const raw = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
  const decision = parseDecision(raw.decision);
  if (!decision) {
    return NextResponse.json({ error: 'Décision attendue : valider ou ignorer' }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();

  // La RLS garantit déjà l'agence ; cette lecture sert à vérifier que la
  // proposition existe et à connaître son type avant de la consommer.
  const avant = await lireAction(supabase, id);
  if (!avant) {
    return NextResponse.json({ error: 'Proposition introuvable' }, { status: 404 });
  }
  if (avant.statut !== 'proposee') {
    return NextResponse.json({ error: 'Proposition déjà traitée' }, { status: 409 });
  }

  const action = await resoudreAction(
    supabase,
    id,
    decision === 'valider' ? 'validee' : 'ignoree',
    profile.id,
  );
  if (!action) {
    // Quelqu'un d'autre est passé entre la lecture et l'écriture.
    return NextResponse.json({ error: 'Proposition déjà traitée' }, { status: 409 });
  }

  if (decision === 'ignorer') {
    return NextResponse.json({ action });
  }

  // Seul le compte rendu déclenche un envoi. Les autres validations sont des
  // accusés de prise en charge : l'agent appelle lui-même.
  if (action.kind === 'compte_rendu_mandat') {
    const cr = action.payload.compteRendu as CompteRendu | undefined;
    if (!cr) {
      return NextResponse.json(
        { action, envoye: false, error: 'Compte rendu illisible.' },
        { status: 422 },
      );
    }
    try {
      await sendCompteRenduMandat(cr, agency.name);
      return NextResponse.json({ action, envoye: true });
    } catch (err) {
      // La proposition reste validée : le compte rendu a bien été relu et
      // approuvé. On dit franchement que l'envoi a échoué plutôt que de
      // laisser croire au vendeur informé.
      const message = err instanceof Error ? err.message : "Envoi impossible.";
      console.error('[actions] envoi compte rendu', id, message);
      return NextResponse.json({ action, envoye: false, error: message }, { status: 502 });
    }
  }

  return NextResponse.json({ action, envoye: false });
}
