/**
 * Envoi Web Push.
 *
 * Le nettoyage compte autant que l'envoi : un navigateur désinstallé ou un
 * abonnement révoqué répond 404/410, et il faut supprimer la ligne. Sans ça la
 * table enfle, chaque brief traîne sur des abonnements morts, et les erreurs
 * finissent par masquer les vraies.
 */

import webpush from 'web-push';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

type Client = SupabaseClient<Database>;

export interface PushPayload {
  titre: string;
  corps: string;
  url: string;
  tag?: string;
}

export interface AbonnementPush {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

let configure = false;

/** Rend false si les clés VAPID manquent : le cron doit pouvoir le dire. */
export function configurerVapid(): boolean {
  if (configure) return true;

  const publique = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const privee = process.env.VAPID_PRIVATE_KEY?.trim();
  const sujet = process.env.VAPID_SUBJECT?.trim() || 'mailto:hello@priimo.fr';
  if (!publique || !privee) return false;

  webpush.setVapidDetails(sujet, publique, privee);
  configure = true;
  return true;
}

export interface ResultatEnvoi {
  envoyes: number;
  supprimes: number;
  echecs: number;
}

/**
 * Envoie une notification à tous les appareils d'un agent.
 * Les abonnements morts sont supprimés au passage.
 */
export async function envoyerPush(
  admin: Client,
  abonnements: readonly AbonnementPush[],
  payload: PushPayload,
): Promise<ResultatEnvoi> {
  if (!configurerVapid()) {
    console.error('[push] clés VAPID absentes — aucun envoi');
    return { envoyes: 0, supprimes: 0, echecs: abonnements.length };
  }

  const corps = JSON.stringify(payload);
  const morts: string[] = [];
  let envoyes = 0;
  let echecs = 0;

  await Promise.all(
    abonnements.map(async (abo) => {
      try {
        await webpush.sendNotification(
          { endpoint: abo.endpoint, keys: { p256dh: abo.p256dh, auth: abo.auth } },
          corps,
          { TTL: 6 * 3600 },
        );
        envoyes += 1;
      } catch (err) {
        const statut = (err as { statusCode?: number }).statusCode;
        // 404 / 410 : l'abonnement n'existe plus côté navigateur.
        if (statut === 404 || statut === 410) morts.push(abo.id);
        else {
          echecs += 1;
          console.error('[push] envoi', statut ?? '', err instanceof Error ? err.message : err);
        }
      }
    }),
  );

  if (morts.length > 0) {
    const { error } = await admin.from('push_subscriptions').delete().in('id', morts);
    if (error) console.error('[push] nettoyage', error.message);
  }

  if (envoyes > 0) {
    await admin
      .from('push_subscriptions')
      .update({ last_success_at: new Date().toISOString() })
      .in(
        'id',
        abonnements.filter((a) => !morts.includes(a.id)).map((a) => a.id),
      );
  }

  return { envoyes, supprimes: morts.length, echecs };
}

/** Abonnements d'un agent. */
export async function abonnementsDuProfil(
  admin: Client,
  profileId: string,
): Promise<AbonnementPush[]> {
  const { data, error } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('profile_id', profileId);

  if (error) {
    console.error('[push] lecture abonnements', error.message);
    return [];
  }
  return (data ?? []) as AbonnementPush[];
}
