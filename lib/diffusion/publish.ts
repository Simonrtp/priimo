/**
 * Publication idempotente d'un bien sur un portail.
 * Le bien reste la source de vérité ; on ne duplique pas le contenu éditable.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Annonce, PortailId } from './types';
import { assessAnnonceForPortail } from './completeness';
import { getDiffusionTransport, type GatewayKind } from './transport/gateway';

export function cleIdempotence(bienId: string, portail: PortailId): string {
  return `${bienId}:${portail}`;
}

export type PublishOutcome =
  | { ok: true; annonceId: string; statut: string; referencePortail: string | null }
  | { ok: false; reason: 'validation' | 'error'; blockers?: string[]; message: string };

export async function publierAnnonce(args: {
  admin: SupabaseClient;
  agencyId: string;
  bienId: string;
  portail: PortailId;
  annonce: Annonce;
  gateway?: GatewayKind;
}): Promise<PublishOutcome> {
  const { admin, agencyId, bienId, portail, annonce } = args;
  const completeness = assessAnnonceForPortail(annonce, portail);
  if (completeness.blockers.length > 0) {
    return {
      ok: false,
      reason: 'validation',
      blockers: completeness.blockers.map((b) => b.label),
      message: 'Annonce incomplète — envoi annulé avant passage portail.',
    };
  }

  const cle = cleIdempotence(bienId, portail);
  const { data: existing } = await admin
    .from('diffusion_annonces')
    .select('id, statut, reference_portail')
    .eq('agency_id', agencyId)
    .eq('cle_idempotence', cle)
    .maybeSingle();

  let annonceId = existing?.id as string | undefined;
  if (!annonceId) {
    const { data: inserted, error } = await admin
      .from('diffusion_annonces')
      .insert({
        agency_id: agencyId,
        bien_id: bienId,
        portail,
        statut: 'en_attente',
        cle_idempotence: cle,
      })
      .select('id')
      .single();
    if (error || !inserted) {
      return {
        ok: false,
        reason: 'error',
        message: error?.message ?? 'Impossible de créer diffusion_annonces',
      };
    }
    annonceId = inserted.id;
  } else if (existing?.statut === 'publiee' && existing.reference_portail) {
    // Idempotence : déjà publiée → mise à jour, pas de 2e annonce.
    try {
      const transport = getDiffusionTransport(args.gateway);
      const ack = await transport.mettreAJour(annonce, portail, existing.reference_portail);
      await admin.from('diffusion_evenements').insert({
        agency_id: agencyId,
        annonce_id: annonceId,
        bien_id: bienId,
        portail,
        sens: 'sortie',
        kind: 'maj',
        message: ack.message,
        payload: { reference: ack.referencePortail },
      });
      return {
        ok: true,
        annonceId,
        statut: 'publiee',
        referencePortail: existing.reference_portail,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await admin
        .from('diffusion_annonces')
        .update({ dernier_erreur: message })
        .eq('id', annonceId);
      await admin.from('diffusion_evenements').insert({
        agency_id: agencyId,
        annonce_id: annonceId,
        bien_id: bienId,
        portail,
        sens: 'sortie',
        kind: 'erreur_maj',
        message,
      });
      return { ok: false, reason: 'error', message };
    }
  } else {
    await admin
      .from('diffusion_annonces')
      .update({ statut: 'en_attente', dernier_erreur: null })
      .eq('id', annonceId);
  }

  try {
    const transport = getDiffusionTransport(args.gateway);
    const ack =
      existing?.reference_portail && existing.statut !== 'retiree'
        ? await transport.mettreAJour(annonce, portail, existing.reference_portail)
        : await transport.publier(annonce, portail);

    const reference = ack.referencePortail ?? existing?.reference_portail ?? null;
    await admin
      .from('diffusion_annonces')
      .update({
        statut: 'publiee',
        reference_portail: reference,
        publiee_at: new Date().toISOString(),
        dernier_erreur: null,
      })
      .eq('id', annonceId);

    await admin.from('diffusion_evenements').insert({
      agency_id: agencyId,
      annonce_id: annonceId,
      bien_id: bienId,
      portail,
      sens: 'sortie',
      kind: 'publication',
      message: ack.message,
      payload: { reference },
    });

    return { ok: true, annonceId, statut: 'publiee', referencePortail: reference };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await admin
      .from('diffusion_annonces')
      .update({ statut: 'refusee', dernier_erreur: message })
      .eq('id', annonceId);
    await admin.from('diffusion_evenements').insert({
      agency_id: agencyId,
      annonce_id: annonceId,
      bien_id: bienId,
      portail,
      sens: 'sortie',
      kind: 'refus',
      message,
    });
    return { ok: false, reason: 'error', message };
  }
}
