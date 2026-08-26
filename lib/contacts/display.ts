import type { InteractionKind } from '@/types/contact';
import type { MandatStatut } from '@/types/bien';
import { MANDAT_STATUT_LABELS } from '@/types/bien';
import type { Contact, SearchCriteria } from '@/types/contact';

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
  if (input.bienAddress) {
    const statut = input.mandatStatut ? MANDAT_STATUT_LABELS[input.mandatStatut] : null;
    return [statut, input.bienAddress].filter(Boolean).join(' · ');
  }
  if (input.leadAddress) return `Lead · ${input.leadAddress}`;
  return '';
}

export function contactInitials(contact: Pick<Contact, 'firstName' | 'lastName' | 'fullName'>): string {
  const a = contact.firstName.trim().charAt(0);
  const b = contact.lastName.trim().charAt(0);
  const out = `${a}${b}`.toUpperCase();
  if (out.trim()) return out;
  return (contact.fullName.trim().charAt(0) || '?').toUpperCase();
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
  if (contact.type === 'acquereur' || contact.type === 'locataire') {
    const crit = formatAcquereurCriteria(contact.criteria);
    if (crit) bits.push(crit);
  } else if (contact.type === 'vendeur') {
    const vendeur = formatVendeurMeta({
      mandatStatut: ctx.mandatStatut,
      bienAddress: ctx.bienAddress,
      leadAddress: ctx.leadAddress,
    });
    if (vendeur) bits.push(vendeur);
  } else if (contact.type === 'gardien' || contact.type === 'commercant') {
    if (contact.address) bits.push(contact.address);
  } else {
    if (contact.secteur) bits.push(contact.secteur);
    if (contact.address) bits.push(contact.address);
  }
  if (ctx.assigneeName) bits.push(ctx.assigneeName);
  return bits.join(' · ');
}
