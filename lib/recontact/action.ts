import type { TodayCardAction } from '@/lib/today/cards';

/** CTA de relance : un numéro présent s'appelle. Sinon, la fiche. */
export function actionJoindre(args: {
  phone: string | null | undefined;
  contactId?: string | null;
  leadId?: string | null;
  labelAppeler: string;
  labelFiche: string;
}): TodayCardAction {
  if (args.phone) {
    return {
      kind: 'appeler',
      label: args.labelAppeler,
      phone: args.phone,
      contactId: args.contactId ?? undefined,
      leadId: args.leadId ?? undefined,
    };
  }
  if (args.contactId) {
    return { kind: 'ouvrir_contact', label: args.labelFiche, contactId: args.contactId };
  }
  if (args.leadId) {
    return { kind: 'ouvrir_lead', label: args.labelFiche, leadId: args.leadId };
  }
  return { kind: 'ouvrir_liste', label: args.labelFiche, cardType: 'relance' };
}
