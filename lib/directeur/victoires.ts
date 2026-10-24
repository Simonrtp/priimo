import { dateKeyParis } from '@/lib/today/calendar';
import { dansLaSemaine, type Intervalle } from '@/lib/activite/semaines';
import { formatPhoneOrNull } from '@/lib/import/normalize';
import { formatAcquiredPriceLine, hasDisplayableAcquiredPrice } from '@/lib/lead-valorisation';
import { formatPrice } from '@/lib/utils';
import { CONTACT_TYPE_LABELS, type ContactType } from '@/types/contact';
import { MANDAT_STATUT_LABELS, type MandatStatut } from '@/types/bien';
import type { VictoireContact, VictoireSemaine } from './agence';

/** Lead déjà chargé pour l'accueil : seulement ce qui décrit la victoire. */
export type LeadPourVictoire = {
  id: string;
  address: string;
  city: string | null;
  postalCode: string | null;
  propertyType: string | null;
  surfaceM2: number | null;
  rooms: number | null;
  etage: string | null;
  dpeClass: string | null;
  acquiredYear: number | null;
  acquiredPrice: number | null;
  acquiredPriceReliable: boolean | null;
  ownerName: string | null;
  ownerPhone: string | null;
  /** 'probable' : téléphone d'une société domiciliée, pas confirmé sur ce bien. */
  ownerPhoneSource: 'cible' | 'probable' | null;
  ownerType: string;
  companyName: string | null;
  companyDirector: string | null;
  companyPhone: string | null;
  companyEmail: string | null;
  banId: string | null;
};

export type BienPourVictoire = {
  id: string;
  leadId: string | null;
  banId: string | null;
  address: string;
  city: string | null;
  postalCode: string | null;
  propertyType: string | null;
  surfaceM2: number | null;
  rooms: number | null;
  price: number | null;
  mandatStatut: string;
  proprietaireContactId: string | null;
  proprietaireName: string | null;
  proprietairePhone: string | null;
  proprietaireEmail: string | null;
};

export type ContactPourVictoire = {
  id: string;
  leadId: string | null;
  fullName: string;
  phone: string | null;
  email: string | null;
  type: string;
};

type TransitionVictoire = {
  leadId: string;
  profileId: string | null;
  versCle: string | null;
  createdAt: string;
};

const RANG_MANDAT: Record<string, number> = {
  mandat_exclusif: 0,
  mandat_simple: 1,
  compromis: 2,
  vendu: 3,
  estimation: 4,
  archive: 5,
};

const MANDAT_A_DIRE = new Set<string>([
  'mandat_simple',
  'mandat_exclusif',
  'compromis',
  'vendu',
]);

/** Jour et heure à Paris : « jeu. 23 oct., 14:30 ». */
export function quandVictoire(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Paris',
  }).format(date);
}

/**
 * Victoires de la semaine (mandat signé, rendez-vous obtenu), les plus récentes d'abord.
 * Adresse, bien et contact ne sont remplis que lorsqu'un lien existe déjà.
 */
export function victoiresDeLaSemaine(input: {
  transitions: readonly TransitionVictoire[];
  semaine: Intervalle;
  prenoms: ReadonlyMap<string, string>;
  leads: readonly LeadPourVictoire[];
  biens: readonly BienPourVictoire[];
  contacts: readonly ContactPourVictoire[];
}): VictoireSemaine[] {
  const leads = new Map(input.leads.map((lead) => [lead.id, lead]));
  const out: VictoireSemaine[] = [];

  for (const transition of input.transitions) {
    if (transition.versCle !== 'mandat' && transition.versCle !== 'rendez_vous') continue;
    if (!transition.profileId) continue;
    const date = new Date(transition.createdAt);
    if (Number.isNaN(date.getTime())) continue;
    const jour = dateKeyParis(date);
    if (!dansLaSemaine(jour, input.semaine)) continue;

    const lead = leads.get(transition.leadId) ?? null;
    const bien = choisirBien(transition.leadId, lead?.banId ?? null, input.biens);
    const adresse = composerAdresse(
      lead?.address || bien?.address,
      lead?.address ? lead.city : bien?.city ?? null,
      lead?.address ? lead.postalCode : bien?.postalCode ?? null,
    );

    out.push({
      kind: transition.versCle,
      prenom: input.prenoms.get(transition.profileId) ?? 'Un collègue',
      label: transition.versCle === 'mandat' ? 'mandat signé' : 'rendez-vous obtenu',
      quand: transition.createdAt,
      leadId: lead ? lead.id : transition.leadId || null,
      adresse,
      contacts: contactsDe(lead, bien, input.contacts),
      bien: decrireBien(lead, bien),
    });
  }

  out.sort(
    (a, b) =>
      (b.quand ?? '').localeCompare(a.quand ?? '') ||
      a.prenom.localeCompare(b.prenom, 'fr') ||
      (a.leadId ?? '').localeCompare(b.leadId ?? ''),
  );
  return out;
}

function choisirBien(
  leadId: string,
  banId: string | null,
  biens: readonly BienPourVictoire[],
): BienPourVictoire | null {
  const parLead = biens.filter((bien) => bien.leadId === leadId);
  if (parLead.length > 0) return meilleurBien(parLead);
  if (!banId) return null;
  const parBan = biens.filter((bien) => bien.banId === banId);
  return parBan.length === 1 ? parBan[0]! : null;
}

function meilleurBien(biens: readonly BienPourVictoire[]): BienPourVictoire {
  return [...biens].sort(
    (a, b) => (RANG_MANDAT[a.mandatStatut] ?? 9) - (RANG_MANDAT[b.mandatStatut] ?? 9),
  )[0]!;
}

function composerAdresse(
  address: string | null | undefined,
  city: string | null | undefined,
  postalCode: string | null | undefined,
): string | null {
  const base = address?.trim() ?? '';
  if (!base) return null;
  const bas = base.toLowerCase();
  const morceaux: string[] = [];
  const cp = postalCode?.trim() ?? '';
  const ville = city?.trim() ?? '';
  if (cp && !bas.includes(cp)) morceaux.push(cp);
  if (ville && !bas.includes(ville.toLowerCase())) morceaux.push(ville);
  return morceaux.length > 0 ? `${base}, ${morceaux.join(' ')}` : base;
}

function contactsDe(
  lead: LeadPourVictoire | null,
  bien: BienPourVictoire | null,
  contacts: readonly ContactPourVictoire[],
): VictoireSemaine['contacts'] {
  const vus = new Set<string>();
  const out: VictoireContact[] = [];
  const push = (contact: VictoireContact) => {
    const nom = contact.nom.trim();
    if (!nom) return;
    const cle = contact.id ?? `nom:${nom.toLocaleLowerCase('fr')}`;
    if (vus.has(cle)) return;
    vus.add(cle);
    out.push({ ...contact, nom });
  };

  if (bien?.proprietaireContactId) {
    const fiche = contacts.find((contact) => contact.id === bien.proprietaireContactId);
    if (fiche) push(depuisFiche(fiche));
    else if (bien.proprietaireName?.trim()) {
      push({
        id: null,
        nom: bien.proprietaireName,
        telephone: formatPhoneOrNull(bien.proprietairePhone),
        email: emailOuNull(bien.proprietaireEmail),
        role: 'Propriétaire',
      });
    }
  }

  const lies = contacts
    .filter((contact) => lead && contact.leadId === lead.id)
    .sort(
      (a, b) =>
        rangContact(a) - rangContact(b) || a.fullName.localeCompare(b.fullName, 'fr'),
    );
  for (const contact of lies) push(depuisFiche(contact));

  if (out.length > 0 || !lead) return out;

  if (lead.ownerType === 'entreprise') {
    const nom = lead.companyDirector?.trim() || lead.companyName?.trim() || '';
    if (nom) {
      push({
        id: null,
        nom,
        telephone: formatPhoneOrNull(lead.companyPhone),
        email: emailOuNull(lead.companyEmail),
        role:
          lead.companyDirector?.trim() && lead.companyName?.trim()
            ? lead.companyName.trim()
            : 'Société',
      });
    }
    return out;
  }

  if (lead.ownerName?.trim()) {
    push({
      id: null,
      nom: lead.ownerName,
      telephone:
        lead.ownerPhoneSource === 'probable' ? null : formatPhoneOrNull(lead.ownerPhone),
      email: null,
      role: 'Propriétaire',
    });
  }
  return out;
}

function depuisFiche(contact: ContactPourVictoire): NonNullable<VictoireSemaine['contacts']>[number] {
  const role = CONTACT_TYPE_LABELS[contact.type as ContactType] ?? null;
  return {
    id: contact.id,
    nom: contact.fullName,
    telephone: formatPhoneOrNull(contact.phone),
    email: emailOuNull(contact.email),
    role,
  };
}

function rangContact(contact: ContactPourVictoire): number {
  return contact.type === 'vendeur' ? 0 : 1;
}

function emailOuNull(email: string | null | undefined): string | null {
  const valeur = email?.trim() ?? '';
  return valeur || null;
}

function decrireBien(
  lead: LeadPourVictoire | null,
  bien: BienPourVictoire | null,
): VictoireSemaine['bien'] {
  const type = libelleType(bien?.propertyType || lead?.propertyType);
  const surface = nombrePositif(bien?.surfaceM2) ?? nombrePositif(lead?.surfaceM2);
  const pieces = nombrePositif(bien?.rooms) ?? nombrePositif(lead?.rooms);
  const morceaux = [
    type,
    surface != null ? `${surface} m²` : null,
    pieces != null ? (pieces === 1 ? '1 pièce' : `${pieces} pièces`) : null,
    etageLibelle(lead?.etage),
    dpeLibelle(lead?.dpeClass),
  ].filter((part): part is string => Boolean(part));
  const precisions = morceaux.length > 0 ? morceaux.join(' · ') : null;
  const prixNombre = nombrePositif(bien?.price);
  const prix = prixNombre != null ? `${formatPrice(prixNombre)} €` : null;
  const achat =
    lead && hasDisplayableAcquiredPrice(lead)
      ? formatAcquiredPriceLine(lead, { strictReliable: true })
      : null;
  const mandat =
    bien && MANDAT_A_DIRE.has(bien.mandatStatut)
      ? MANDAT_STATUT_LABELS[bien.mandatStatut as MandatStatut]
      : null;
  if (!bien && !precisions && !achat) return null;
  return {
    id: bien?.id ?? null,
    precisions,
    prix,
    achat,
    mandat,
  };
}

function libelleType(type: string | null | undefined): string | null {
  const valeur = type?.trim() ?? '';
  if (!valeur) return null;
  return valeur.charAt(0).toUpperCase() + valeur.slice(1);
}

function nombrePositif(valeur: number | null | undefined): number | null {
  return typeof valeur === 'number' && Number.isFinite(valeur) && valeur > 0 ? valeur : null;
}

function etageLibelle(etage: string | null | undefined): string | null {
  const valeur = etage?.trim() ?? '';
  if (!valeur) return null;
  if (valeur === '0' || valeur.toLowerCase() === 'rdc') return 'RDC';
  if (/^\d+$/.test(valeur)) return `${valeur}e étage`;
  return valeur;
}

function dpeLibelle(dpe: string | null | undefined): string | null {
  const lettre = dpe?.trim().toUpperCase() ?? '';
  return /^[A-G]$/.test(lettre) ? `DPE ${lettre}` : null;
}
