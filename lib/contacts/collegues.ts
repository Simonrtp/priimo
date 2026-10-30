/**
 * Un contact appartient à celui qui l'a saisi en premier. Quand un
 * négociateur entre un numéro ou un e-mail déjà présent dans la fiche d'un
 * collègue, la création est refusée : il appelle le titulaire, et la
 * direction est prévenue dans « À valider ».
 *
 * Les fiches des collègues ne lui sont jamais montrées. Le refus ne révèle
 * que le titulaire et ses coordonnées. La direction voit tout : pour elle,
 * c'est le contrôle de doublons habituel, avec « Créer quand même ».
 */

import { canSeeContact, recordOwnerId, type RecordViewer } from '@/lib/agency/visibility';
import { emailsMatch, phonesMatch } from '@/lib/contacts/duplicates';
import { formatPhoneDisplay, normalizeEmail, normalizePhone } from '@/lib/import/normalize';
import { expiresInDays, type ProposedAction } from '@/lib/automations/types';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export type FicheDuplicable = {
  id: string;
  assignedTo: string | null;
  createdBy: string | null;
  phone: string | null;
  email: string | null;
};

export type RaisonCollegue = 'telephone' | 'email';

export type ConflitCollegue = {
  contactId: string;
  /** Titulaire de la fiche existante ; null si elle n'a plus de titulaire. */
  titulaireId: string | null;
  raison: RaisonCollegue;
};

/**
 * Fiches de collègues qui portent le même téléphone ou le même e-mail que la
 * saisie. Seules les fiches que `viewer` ne voit pas comptent : les siennes
 * relèvent du contrôle de doublons ordinaire, et la direction les voit toutes.
 */
export function conflitsChezCollegues(
  viewer: RecordViewer,
  saisie: { phone: string | null; email: string | null },
  fiches: readonly FicheDuplicable[],
): ConflitCollegue[] {
  if (viewer.role === 'directeur') return [];
  if (!saisie.phone && !saisie.email) return [];

  const conflits: ConflitCollegue[] = [];
  for (const fiche of fiches) {
    if (canSeeContact(viewer, fiche)) continue;
    const raison: RaisonCollegue | null = phonesMatch(saisie.phone, fiche.phone)
      ? 'telephone'
      : emailsMatch(saisie.email, fiche.email)
        ? 'email'
        : null;
    if (!raison) continue;
    conflits.push({ contactId: fiche.id, titulaireId: recordOwnerId(fiche), raison });
  }
  // Le numéro avant l'e-mail : c'est lui que la direction vérifie en premier.
  return conflits.sort((a, b) => (a.raison === b.raison ? 0 : a.raison === 'telephone' ? -1 : 1));
}

/**
 * Même règle que `conflitsChezCollegues`, en index : un import de milliers de
 * lignes face à des milliers de fiches reste instantané.
 */
export function indexerChezCollegues(viewer: RecordViewer, fiches: readonly FicheDuplicable[]) {
  const parTelephone = new Map<string, FicheDuplicable>();
  const parEmail = new Map<string, FicheDuplicable>();

  if (viewer.role !== 'directeur') {
    for (const fiche of fiches) {
      if (canSeeContact(viewer, fiche)) continue;
      const tel = fiche.phone ? normalizePhone(fiche.phone) : '';
      if (tel.length >= 10 && !parTelephone.has(tel)) parTelephone.set(tel, fiche);
      const mail = fiche.email ? normalizeEmail(fiche.email) : '';
      if (mail && !parEmail.has(mail)) parEmail.set(mail, fiche);
    }
  }

  return {
    trouver(saisie: { phone: string | null; email: string | null }): ConflitCollegue | null {
      const tel = saisie.phone ? normalizePhone(saisie.phone) : '';
      const parTel = tel.length >= 10 ? parTelephone.get(tel) : undefined;
      if (parTel) return { contactId: parTel.id, titulaireId: recordOwnerId(parTel), raison: 'telephone' };
      const mail = saisie.email ? normalizeEmail(saisie.email) : '';
      const parMail = mail ? parEmail.get(mail) : undefined;
      return parMail ? { contactId: parMail.id, titulaireId: recordOwnerId(parMail), raison: 'email' } : null;
    },
  };
}

export type CoordonneesCollegue = {
  id: string;
  nomComplet: string;
  prenom: string;
  telephone: string | null;
  email: string | null;
};

/** Ce que le négociateur bloqué voit du titulaire : de quoi l'appeler, rien de plus. */
export type CollegueAffiche = {
  nom: string;
  telephone: string | null;
  email: string | null;
};

export function collegueAffiche(c: CoordonneesCollegue | null): CollegueAffiche | null {
  return c ? { nom: c.nomComplet, telephone: c.telephone, email: c.email } : null;
}

/**
 * Nom, téléphone et e-mail d'un membre de *cette* agence. L'agence passe par
 * `profile_agencies` : un identifiant venu d'une fiche ne suffit pas à lire
 * le profil d'une autre agence.
 */
export async function coordonneesCollegue(
  agencyId: string,
  profileId: string | null,
): Promise<CoordonneesCollegue | null> {
  if (!profileId) return null;
  const admin = createSupabaseAdminClient();

  const { data: lien } = await admin
    .from('profile_agencies')
    .select('profile_id')
    .eq('agency_id', agencyId)
    .eq('profile_id', profileId)
    .maybeSingle();
  if (!lien) return null;

  const complet = await admin
    .from('profiles')
    .select('id, first_name, last_name, phone, email_pro')
    .eq('id', profileId)
    .maybeSingle();
  const profil = complet.error
    ? await admin.from('profiles').select('id, first_name, last_name, phone').eq('id', profileId).maybeSingle()
    : complet;
  if (!profil.data) return null;

  const row = profil.data as {
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
    email_pro?: string | null;
  };
  let email = row.email_pro?.trim() || null;
  if (!email) {
    const { data } = await admin.auth.admin.getUserById(profileId);
    email = data.user?.email ?? null;
  }

  const prenom = (row.first_name ?? '').trim();
  const nom = (row.last_name ?? '').trim();
  return {
    id: profileId,
    prenom,
    nomComplet: [prenom, nom].filter(Boolean).join(' ') || 'un collègue',
    telephone: row.phone?.trim() || null,
    email,
  };
}

/**
 * `avecCoordonnees` pour les écrans qui n'affichent qu'une phrase (toast) :
 * le numéro et l'e-mail du titulaire suivent le nom.
 */
export function messageChezCollegue(collegue: CollegueAffiche | null, avecCoordonnees = false): string {
  if (!collegue) return "Ce contact est déjà dans la base de l'agence.";
  const base = `Ce contact est déjà suivi par ${collegue.nom}.`;
  if (!avecCoordonnees) return base;
  const coordonnees = [collegue.telephone ? formatPhoneDisplay(collegue.telephone) : null, collegue.email]
    .filter(Boolean)
    .join(' · ');
  return coordonnees ? `${base} ${coordonnees}` : base;
}

/** Clé d'unicité : un même négociateur bloqué deux fois sur la même fiche ne prévient pas deux fois. */
export function cleDoublonContact(auteurId: string, contactId: string): string {
  return `doublon_contact:${auteurId}:${contactId}`;
}

/**
 * Ce que reçoit la direction. `saisie` est ce que le négociateur a tapé :
 * « Créer quand même » la rejoue telle quelle, à son nom.
 */
export function propositionDoublon(args: {
  auteurId: string;
  auteurPrenom: string;
  nomSaisi: string;
  contactId: string;
  titulaire: CoordonneesCollegue | null;
  raison: RaisonCollegue;
  saisie: Record<string, unknown>;
}): ProposedAction {
  const { auteurPrenom, nomSaisi, titulaire, raison } = args;
  const prenom = auteurPrenom.trim() || 'Un négociateur';
  const quoi = raison === 'telephone' ? 'même téléphone' : 'même e-mail';
  const chez = titulaire ? `la base de ${titulaire.nomComplet}` : "la base de l'agence";
  return {
    kind: 'doublon_contact',
    dedupKey: cleDoublonContact(args.auteurId, args.contactId),
    titre: `${prenom} a tenté d'ajouter ${nomSaisi}`,
    detail: `Déjà dans ${chez} (${quoi}). Le créer quand même le mettra chez ${prenom}.`,
    payload: {
      contactId: args.contactId,
      auteurId: args.auteurId,
      auteurPrenom: prenom,
      titulaireId: titulaire?.id ?? null,
      titulaireNom: titulaire?.nomComplet ?? null,
      raison,
      saisie: args.saisie,
    },
    score: 70,
    assignedTo: null,
    expiresAt: expiresInDays(30),
  };
}
