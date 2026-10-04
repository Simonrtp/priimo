import type { NotificationType } from './types';

function pluriel(n: number, un: string, plusieurs: string): string {
  return n > 1 ? plusieurs : un;
}

export function titreLeadsLivresNego(n: number): string {
  return n === 1
    ? '1 adresse dans ton secteur'
    : `${n} adresses dans ton secteur`;
}

export function corpsLeadsLivresNego(): string {
  return 'Livrées ce lundi.';
}

export function titreLeadsLivresDirecteur(n: number): string {
  return n === 1 ? '1 adresse livrée' : `${n} adresses livrées`;
}

export function corpsLeadsLivresDirecteur(secteurs: number): string {
  if (secteurs <= 0) return 'Hors secteur attribué.';
  return secteurs === 1
    ? 'Réparties sur 1 secteur.'
    : `Réparties sur ${secteurs} secteurs.`;
}

export function titreLeadsAssignes(n: number): string {
  return n === 1 ? 'Un lead t’a été assigné' : `${n} leads t’ont été assignés`;
}

export function titreContactTransfere(n: number): string {
  return n === 1
    ? 'Un contact t’a été transféré'
    : `${n} contacts t’ont été transférés`;
}

export function titreNotesTranscrites(n: number): string {
  return n === 1 ? 'Une note prête à relire' : `${n} notes prêtes à relire`;
}

export function titreInvitationAcceptee(prenom: string): string {
  return `${prenom} a rejoint l’agence`;
}

export function titreZoneModifiee(): string {
  return 'Ton secteur a été modifié';
}

export function titreZoneAttribuee(nom: string): string {
  return `Le secteur ${nom} t’a été attribué`;
}

export function titreAnniversaire(prenom: string): string {
  return `C’est l’anniversaire de ${prenom}`;
}

export function titreNegociateurSansActivite(prenom: string): string {
  return `${prenom} : 7 jours sans activité`;
}

export function titreZoneNonTravaillee(nom: string): string {
  return `Le secteur ${nom} n’a pas été travaillé`;
}

export function titreAdressesARevoir(n: number): string {
  return n === 1
    ? '1 adresse n’a pas été passée'
    : `${n} adresses n’ont pas été passées`;
}

export function corpsAdressesARevoir(): string {
  return 'Depuis trop longtemps.';
}

export function titreMandat60Jours(n: number): string {
  return n === 1
    ? '1 mandat passe les 60 jours'
    : `${n} mandats passent les 60 jours`;
}

export function titreImmeublesSuivis(n: number): string {
  return n === 1
    ? 'Un immeuble suivi a bougé'
    : `${n} immeubles suivis ont bougé`;
}

export function corpsImmeublesSuivis(): string {
  return 'À retrouver dans « À valider ».';
}

export function titreSuiviImmeuble(): string {
  return 'Tu suis cet immeuble';
}

export function corpsSuiviImmeuble(libelle: string | null): string {
  const lieu = libelle?.trim();
  return lieu || 'Tu seras prévenu d’un nouveau DPE, d’une vente ou d’un audit.';
}

/** Titre d’une ligne regroupée. Une seule notification : on garde son titre. */
export function titreGroupe(type: NotificationType, n: number, titreSeul: string): string {
  if (n <= 1) return titreSeul;
  switch (type) {
    case 'note_transcrite':
      return titreNotesTranscrites(n);
    case 'leads_assignes':
      return titreLeadsAssignes(n);
    case 'contact_transfere':
      return titreContactTransfere(n);
    case 'immeuble_suivi':
      return titreImmeublesSuivis(n);
    case 'suivi_immeuble':
      return n === 1 ? titreSeul : `${n} immeubles suivis`;
    case 'leads_livres':
      return titreSeul;
    default:
      return `${n} ${pluriel(n, 'notification', 'notifications')}`;
  }
}

export function corpsGroupe(type: NotificationType, n: number, corpsSeul: string): string {
  if (n <= 1) return corpsSeul;
  switch (type) {
    case 'note_transcrite':
      return 'Dictées prêtes à relire.';
    case 'leads_assignes':
      return 'À retrouver dans la prospection.';
    case 'contact_transfere':
      return 'Fiches transmises par un collègue.';
    case 'immeuble_suivi':
      return corpsImmeublesSuivis();
    case 'suivi_immeuble':
      return 'Mémoire de tes suivis.';
    default:
      return corpsSeul;
  }
}
