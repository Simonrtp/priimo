import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { mondayOf } from '@/lib/today/weekly-snapshot';
import { ecrireNotification, notificationDejaEmise } from './ecrire';
import { LIEN_ADRESSES_A_REVOIR, lienNotification } from './liens';
import {
  corpsAdressesARevoir,
  titreAdressesARevoir,
  titreInvitationAcceptee,
  titreLeadsAssignes,
  titreNotesTranscrites,
  titreZoneAttribuee,
  titreZoneModifiee,
} from './textes';

/** Au-delà, le bandeau Accueil devenait une corvée. Une ligne dans la cloche suffit. */
export const SEUIL_ADRESSES_A_REVOIR = 10;

function admin() {
  return createSupabaseAdminClient();
}

/** Un lead assigné par quelqu'un d'autre. */
export async function notifierLeadsAssignes(params: {
  agencyId: string;
  destinataireId: string;
  actorId: string;
  leadId: string;
  adresse: string;
}): Promise<void> {
  const adresse = params.adresse.trim() || 'Une adresse';
  await ecrireNotification(admin(), {
    agencyId: params.agencyId,
    profileId: params.destinataireId,
    actorId: params.actorId,
    type: 'leads_assignes',
    titre: titreLeadsAssignes(1),
    corps: adresse,
    lien: lienNotification('leads_assignes', params.leadId),
    entiteType: 'lead',
    entiteId: params.leadId,
    groupeCle: 'leads_assignes',
  });
}

export async function notifierContactTransfere(params: {
  agencyId: string;
  destinataireId: string;
  actorId: string;
  contactId: string;
  nom: string;
}): Promise<void> {
  await ecrireNotification(admin(), {
    agencyId: params.agencyId,
    profileId: params.destinataireId,
    actorId: params.actorId,
    type: 'contact_transfere',
    titre: 'Un contact t’a été transféré',
    corps: params.nom.trim() || 'Fiche transmise',
    lien: lienNotification('contact_transfere', params.contactId),
    entiteType: 'contact',
    entiteId: params.contactId,
    groupeCle: 'contact_transfere',
  });
}

export async function notifierInvitationAcceptee(params: {
  agencyId: string;
  nouvelId: string;
  prenom: string;
}): Promise<void> {
  const { data: links } = await admin()
    .from('profile_agencies')
    .select('profile_id, role')
    .eq('agency_id', params.agencyId)
    .eq('role', 'directeur');

  const prenom = params.prenom.trim() || 'Un collègue';
  for (const row of links ?? []) {
    if (row.profile_id === params.nouvelId) continue;
    await ecrireNotification(admin(), {
      agencyId: params.agencyId,
      profileId: row.profile_id,
      actorId: params.nouvelId,
      type: 'invitation_acceptee',
      titre: titreInvitationAcceptee(prenom),
      corps: 'Le compte est prêt.',
      lien: lienNotification('invitation_acceptee', params.nouvelId),
      entiteType: 'profil',
      entiteId: params.nouvelId,
      groupeCle: `invitation_acceptee:${params.nouvelId}`,
    });
  }
}

export async function notifierZoneModifiee(params: {
  agencyId: string;
  actorId: string;
  zoneId: string;
  nom: string;
  ancienTitulaire: string | null;
  nouveauTitulaire: string | null;
  autresChamps: boolean;
}): Promise<void> {
  const dest = new Set<string>();
  if (params.nouveauTitulaire) dest.add(params.nouveauTitulaire);
  if (params.ancienTitulaire && params.ancienTitulaire !== params.nouveauTitulaire) {
    dest.add(params.ancienTitulaire);
  }
  if (params.autresChamps && params.nouveauTitulaire) dest.add(params.nouveauTitulaire);

  for (const profileId of dest) {
    const attribue =
      profileId === params.nouveauTitulaire && params.ancienTitulaire !== params.nouveauTitulaire;
    await ecrireNotification(admin(), {
      agencyId: params.agencyId,
      profileId,
      actorId: params.actorId,
      type: 'zone_modifiee',
      titre: attribue ? titreZoneAttribuee(params.nom) : titreZoneModifiee(),
      corps: attribue ? 'La direction t’en a confié un.' : params.nom,
      lien: lienNotification('zone_modifiee', params.zoneId),
      entiteType: 'zone',
      entiteId: params.zoneId,
      groupeCle: `zone_modifiee:${params.zoneId}`,
    });
  }
}

export async function notifierAdressesARevoir(params: {
  agencyId: string;
  destinataireId: string;
  aRevoir: number;
  now?: Date;
}): Promise<void> {
  if (params.aRevoir <= SEUIL_ADRESSES_A_REVOIR) return;
  const now = params.now ?? new Date();
  const semaine = mondayOf(now);
  const [y, m, d] = semaine.split('-').map(Number);
  const depuisIso = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1, 0, 0, 0)).toISOString();
  const groupeCle = `adresses_a_revoir:${semaine}`;
  const adminClient = admin();
  if (
    await notificationDejaEmise(adminClient, {
      agencyId: params.agencyId,
      profileId: params.destinataireId,
      groupeCle,
      depuisIso,
    })
  ) {
    return;
  }
  await ecrireNotification(adminClient, {
    agencyId: params.agencyId,
    profileId: params.destinataireId,
    type: 'zone_non_travaillee',
    titre: titreAdressesARevoir(params.aRevoir),
    corps: corpsAdressesARevoir(),
    lien: LIEN_ADRESSES_A_REVOIR,
    groupeCle,
  });
}

export async function notifierNoteTranscrite(params: {
  agencyId: string;
  auteurId: string;
  noteId: string;
}): Promise<void> {
  await ecrireNotification(admin(), {
    agencyId: params.agencyId,
    profileId: params.auteurId,
    type: 'note_transcrite',
    titre: titreNotesTranscrites(1),
    corps: 'Ta dictée est prête.',
    lien: lienNotification('note_transcrite', params.noteId),
    entiteType: 'note',
    entiteId: params.noteId,
    groupeCle: 'note_transcrite',
  });
}
