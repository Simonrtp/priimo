import type { InteractionKind } from '@/types/contact';
import type { MandatStatut } from '@/types/bien';
import { MANDAT_STATUT_LABELS } from '@/types/bien';
import type { Contact, SearchCriteria } from '@/types/contact';
import { aLeRole } from '@/types/contact';

export type LatestInteraction = {
  kind: InteractionKind;
  occurredAt: string;
};

function euros(v: number): string {
  if (v >= 1_000_000) {
    const m = v / 1_000_000;
    return `${m.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} M€`;
  }
  if (v >= 1000) return `${Math.round(v / 1000)} k€`;
  return `${v} €`;
}

export function formatAcquereurCriteria(c: SearchCriteria): string {
  const bits: string[] = [];
  if (c.budgetMin != null && c.budgetMax != null) {
    bits.push(`${euros(c.budgetMin)}–${euros(c.budgetMax)}`);
  } else if (c.budgetMax != null) {
    bits.push(`jusqu’à ${euros(c.budgetMax)}`);
  } else if (c.budgetMin != null) {
    bits.push(`dès ${euros(c.budgetMin)}`);
  }
  if (c.roomsMin != null) bits.push(`${c.roomsMin} p. min`);
  if (c.surfaceMin != null) bits.push(`${c.surfaceMin} m² min`);
  if (c.postalCodes.length > 0) bits.push(c.postalCodes.slice(0, 3).join(', '));
  return bits.join(' · ');
}

export function formatVendeurMeta(input: {
  mandatStatut: MandatStatut | null;
  bienAddress: string | null;
  leadAddress: string | null;
}): string {
  if (input.mandatStatut) return MANDAT_STATUT_LABELS[input.mandatStatut];
  return '';
}

/** Adresse du bien, du lead ou de la fiche — pour « rattaché à ». */
export function adresseRattachee(input: {
  bienAddress: string | null;
  leadAddress: string | null;
  contactAddress: string | null;
  bienBanId: string | null;
  contactBanId: string | null;
}): { adresse: string; href: string | null } | null {
  const adresse =
    (input.bienAddress ?? '').trim() ||
    (input.leadAddress ?? '').trim() ||
    (input.contactAddress ?? '').trim() ||
    null;
  if (!adresse) return null;
  const banId = (input.bienBanId ?? '').trim() || (input.contactBanId ?? '').trim() || null;
  return {
    adresse,
    href: banId ? `/dashboard/prospection?vue=carte&immeuble=${encodeURIComponent(banId)}` : null,
  };
}

export function contactInitials(contact: Pick<Contact, 'firstName' | 'lastName' | 'fullName'>): string {
  const a = contact.firstName.trim().charAt(0);
  const b = contact.lastName.trim().charAt(0);
  const out = `${a}${b}`.toUpperCase();
  if (out.trim()) return out;
  return (contact.fullName.trim().charAt(0) || '?').toUpperCase();
}

/**
 * Une teinte douce et stable par lettre, lisible sur le fond clair des initiales.
 * C bleu, P vert, S jaune : le reste du clavier se répartit sans se répéter.
 */
const COULEURS_LETTRES: Record<string, string> = {
  A: '#823542',
  B: '#884A30',
  C: '#305688',
  D: '#354082',
  E: '#52397F',
  F: '#7D3B65',
  G: '#367871',
  H: '#356E82',
  I: '#39795B',
  J: '#347962',
  K: '#377B40',
  L: '#557637',
  M: '#617434',
  N: '#826B35',
  O: '#865932',
  P: '#327B52',
  Q: '#814137',
  R: '#81374B',
  S: '#7D6A2C',
  T: '#815437',
  U: '#3E5C79',
  V: '#42766B',
  W: '#765C42',
  X: '#663E79',
  Y: '#776C31',
  Z: '#426476',
};

const GRIS_LETTRE = '#5C6574';

export function couleurLettre(lettre: string): string {
  const base = lettre.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  return COULEURS_LETTRES[base.charAt(0)] ?? GRIS_LETTRE;
}

export function formatInteractionWhen(iso: string, now = Date.now()): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  const days = Math.floor((now - t) / 86_400_000);
  if (days <= 0) return "aujourd'hui";
  if (days === 1) return 'hier';
  if (days < 7) return `il y a ${days} j`;
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' }).format(new Date(t));
}

export function formatLastInteraction(last: LatestInteraction | null, now = Date.now()): string {
  if (!last) return 'Aucun échange';
  const when = formatInteractionWhen(last.occurredAt, now);
  switch (last.kind) {
    case 'appel':
      return `Appelé ${when}`;
    case 'visite':
      return `Vu en visite ${when}`;
    case 'email':
      return when.startsWith('il y a') || when === 'hier' || when === "aujourd'hui"
        ? `Message envoyé ${when}`
        : `Message envoyé le ${when}`;
    case 'vocal':
      return `Dictée ${when}`;
    default:
      return `Note ${when}`;
  }
}

export function formatRelanceDate(isoDate: string): string {
  const t = Date.parse(`${isoDate.slice(0, 10)}T12:00:00`);
  if (!Number.isFinite(t)) return isoDate;
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(new Date(t));
}

export function formatContactMeta(
  contact: Contact,
  ctx: {
    assigneeName: string | null;
    mandatStatut: MandatStatut | null;
    bienAddress: string | null;
    leadAddress: string | null;
  },
): string {
  const bits: string[] = [];
  // Une vendeuse qui achète aussi : son bien d'abord, ce qu'elle cherche ensuite.
  const vend = aLeRole(contact, 'vendeur');
  const cherche = aLeRole(contact, 'acquereur') || aLeRole(contact, 'locataire');
  if (vend) {
    const vendeur = formatVendeurMeta({
      mandatStatut: ctx.mandatStatut,
      bienAddress: ctx.bienAddress,
      leadAddress: ctx.leadAddress,
    });
    if (vendeur) bits.push(vendeur);
  }
  if (cherche) {
    const crit = formatAcquereurCriteria(contact.criteria);
    if (crit) bits.push(crit);
  }
  if (!vend && !cherche) {
    if (contact.type !== 'gardien' && contact.type !== 'commercant' && contact.secteur) {
      bits.push(contact.secteur);
    }
    if (contact.address) bits.push(contact.address);
  }
  if (ctx.assigneeName) bits.push(`Fait par ${ctx.assigneeName}`);
  return bits.join(' · ');
}
