import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { construireBrief } from '@/lib/push/brief';
import { configurerVapid, envoyerPush, type AbonnementPush } from '@/lib/push/send';

/**
 * Brief du matin — une notification par agent, à 7 h.
 *
 * On ne balaie pas les agents : on part des abonnements. Un agent sans
 * appareil enregistré ne coûte pas une requête, et la boucle reste
 * proportionnelle au nombre de gens qui ont réellement dit oui.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== 'production';
  return req.headers.get('authorization') === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  if (!configurerVapid()) {
    return NextResponse.json(
      { error: 'Clés VAPID absentes : brief désactivé.' },
      { status: 503 },
    );
  }

  const admin = createSupabaseAdminClient();
  const now = new Date();
  const debutJour = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0),
  ).toISOString();
  const finJour = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59),
  ).toISOString();
  const aujourdhui = now.toISOString().slice(0, 10);

  const { data: abos, error } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth, profile_id, agency_id');

  if (error) {
    console.error('[cron/brief-matin]', error);
    return NextResponse.json({ error: 'Lecture abonnements impossible' }, { status: 500 });
  }

  // Un agent, plusieurs appareils : une seule composition, plusieurs envois.
  const parProfil = new Map<string, { agencyId: string; abonnements: AbonnementPush[] }>();
  for (const row of abos ?? []) {
    const r = row as {
      id: string;
      endpoint: string;
      p256dh: string;
      auth: string;
      profile_id: string;
      agency_id: string;
    };
    const entree = parProfil.get(r.profile_id) ?? { agencyId: r.agency_id, abonnements: [] };
    entree.abonnements.push({ id: r.id, endpoint: r.endpoint, p256dh: r.p256dh, auth: r.auth });
    parProfil.set(r.profile_id, entree);
  }

  let envoyes = 0;
  let silencieux = 0;
  let supprimes = 0;

  for (const [profileId, { agencyId, abonnements }] of parProfil) {
    const [profil, actions, rdv, promesses] = await Promise.all([
      admin.from('profiles').select('first_name').eq('id', profileId).maybeSingle(),
      admin
        .from('agency_actions')
        .select('titre, score, assigned_to')
        .eq('agency_id', agencyId)
        .eq('statut', 'proposee')
        .or(`assigned_to.eq.${profileId},assigned_to.is.null`)
        .order('score', { ascending: false })
        .limit(50),
      admin
        .from('rendez_vous')
        .select('id', { count: 'exact', head: true })
        .eq('profile_id', profileId)
        .gte('debut', debutJour)
        .lte('debut', finJour),
      admin
        .from('promesses')
        .select('id', { count: 'exact', head: true })
        .eq('profile_id', profileId)
        .eq('statut', 'a_faire')
        .lte('echeance', aujourdhui),
    ]);

    const lignes = (actions.data ?? []) as { titre: string }[];
    const brief = construireBrief({
      prenom: (profil.data as { first_name?: string } | null)?.first_name ?? null,
      actionsOuvertes: lignes.length,
      meilleureAction: lignes[0]?.titre ?? null,
      rendezVous: rdv.count ?? 0,
      promessesDues: promesses.count ?? 0,
    });

    // Journée vide : on ne notifie pas. C'est ce silence qui garde les
    // notifications activées sur la durée.
    if (!brief) {
      silencieux += 1;
      continue;
    }

    const resultat = await envoyerPush(admin, abonnements, {
      titre: brief.titre,
      corps: brief.corps,
      url: brief.url,
      // Un seul brief visible à la fois, même si l'agent n'a pas ouvert hier.
      tag: 'brief-matin',
    });
    envoyes += resultat.envoyes;
    supprimes += resultat.supprimes;
  }

  return NextResponse.json({
    ok: true,
    agents: parProfil.size,
    envoyes,
    silencieux,
    abonnementsSupprimes: supprimes,
  });
}
