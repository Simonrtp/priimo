import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import { getServerUser } from '@/lib/auth/getServerUser';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { viewerFromProfile } from '@/lib/agency/visibility';
import { normalizeParcelleId } from '@/lib/carte/parcelle-id';
import { fetchParcelleFiche } from '@/lib/queries/parcelle';
import { estEnAttente } from '@/lib/billing/acces';
import { notesPoseesSurLaParcelle } from '@/lib/notes/parcelle-notes';
import { rateLimit } from '@/lib/rate-limit';
import { reserverIa } from '@/lib/ia/quota';
import { chatOnce } from '@/lib/assistant/mistral';
import { stableSystemMessage } from '@/lib/assistant/models';
import { REFORMULER_TIMEOUT_MS } from '@/lib/assistant/repondre';
import { MistralKeyMissingError, requireMistralKey } from '@/lib/voice/transcribe';
import {
  BRIEF_SYSTEM_PROMPT,
  appliquerRedaction,
  briefARediger,
  collecterBrief,
  promptBrief,
  sourceEmpreinte,
  type Brief,
  type LigneBrief,
  type NoteBrief,
} from '@/lib/carte/brief-porte';

export const runtime = 'nodejs';
export const maxDuration = 30;

/** Un brief rédigé ne vieillit pas tant que sa fiche ne bouge pas. */
const DUREE_CACHE_S = 60 * 60 * 24 * 30;

type NoteLue = {
  id: string;
  transcript: string | null;
  created_at: string;
  created_by: string | null;
  visibilite: string | null;
};

class PasEnCache extends Error {}
class PasRedige extends Error {}

/**
 * Rédige le brief une fois par état de la fiche. La clé est l'empreinte de
 * ce que ce lecteur voit : deux agents qui voient la même chose partagent le
 * texte, une note privée en plus et c'est un autre brief.
 *
 * Le premier passage ne fait que lire (il lève si rien n'est en cache) ; le
 * quota n'est réservé qu'avant le second, qui rédige. Une erreur ne se met
 * jamais en cache : un dépassement de temps se retente à l'ouverture suivante.
 */
function briefEnCache(
  empreinte: string,
  lignes: LigneBrief[],
  notes: NoteBrief[],
  etat: { rediger: boolean },
): () => Promise<Brief> {
  return unstable_cache(
    async () => {
      if (!etat.rediger) throw new PasEnCache();
      const reponse = await chatOnce({
        tier: 'tri',
        apiKey: requireMistralKey(),
        maxTokens: 700,
        timeoutMs: REFORMULER_TIMEOUT_MS,
        jsonObject: true,
        messages: [stableSystemMessage(BRIEF_SYSTEM_PROMPT), { role: 'user', content: promptBrief(lignes, notes) }],
      });
      const brief = reponse ? appliquerRedaction(lignes, notes, reponse.texte) : null;
      if (!brief?.redige) throw new PasRedige();
      return brief;
    },
    ['brief-porte', empreinte],
    { revalidate: DUREE_CACHE_S },
  );
}

export async function GET(_req: Request, ctx: { params: Promise<{ parcelleId: string }> }) {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }
  if (estEnAttente(agency)) {
    return NextResponse.json({ error: 'Parcelle inconnue' }, { status: 404 });
  }

  const { parcelleId: raw } = await ctx.params;
  const parcelleId = normalizeParcelleId(decodeURIComponent(raw));
  if (!parcelleId) {
    return NextResponse.json({ error: 'Parcelle inconnue' }, { status: 400 });
  }

  const viewer = viewerFromProfile(profile);
  const [publicDb, agencyDb] = [createSupabaseAdminClient(), await createSupabaseServerClient()];
  const [fiche, noteIds] = await Promise.all([
    fetchParcelleFiche({
      publicDb,
      agencyDb,
      parcelleId,
      agencyId: agency.id,
      postalCodes: agency.codes_postaux ?? [],
      viewer,
    }),
    notesPoseesSurLaParcelle(agencyDb, agency.id, parcelleId).catch(() => null),
  ]);

  let notes: NoteBrief[] | null = null;
  if (noteIds) {
    const { data, error } = noteIds.length
      ? await agencyDb
          .from('voice_notes')
          .select('id, transcript, created_at, created_by, visibilite')
          .eq('agency_id', agency.id)
          .in('id', noteIds)
          .order('created_at', { ascending: false })
          .limit(40)
      : { data: [] as NoteLue[], error: null };
    if (!error) {
      notes = ((data ?? []) as NoteLue[]).map((n) => ({
        id: n.id,
        date: n.created_at.slice(0, 10),
        texte: n.transcript ?? '',
        createdBy: n.created_by,
        visibilite: n.visibilite === 'privee' ? 'privee' : 'agence',
      }));
    }
  }

  // Le tri par visibilité se fait ici, avant toute empreinte ou tout prompt.
  const { lignes, notes: visibles } = collecterBrief(fiche, notes, viewer);
  const brut: Brief = { lignes, redige: false };
  const repondre = (brief: Brief) => NextResponse.json(brief, { headers: { 'Cache-Control': 'no-store' } });

  if (!briefARediger(lignes)) return repondre(brut);

  const empreinte = createHash('sha256').update(sourceEmpreinte(parcelleId, lignes, visibles)).digest('hex');
  const etat = { rediger: false };
  const lire = briefEnCache(empreinte, lignes, visibles, etat);

  try {
    return repondre(await lire());
  } catch (err) {
    if (!(err instanceof PasEnCache)) return repondre(brut);
  }

  const limit = rateLimit(`brief-porte:${profile.id}`, { limit: 120, windowMs: 60 * 60 * 1000 });
  if (!limit.ok || !(await reserverIa('brief_porte'))) return repondre(brut);

  etat.rediger = true;
  try {
    return repondre(await lire());
  } catch (err) {
    if (!(err instanceof PasRedige) && !(err instanceof MistralKeyMissingError)) {
      console.error('[brief-porte]', err);
    }
    return repondre(brut);
  }
}
