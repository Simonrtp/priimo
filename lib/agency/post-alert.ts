'use client';

import { AGENCY_ALERT_LABELS, type AgencyAlertKind } from '@/lib/agency/alerts';
import { notifyError, notifySuccess } from '@/lib/notify';

export async function postAgencyAlert(input: {
  kind: AgencyAlertKind;
  contactId?: string | null;
  leadId?: string | null;
}): Promise<boolean> {
  try {
    const res = await fetch('/api/dashboard/alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      notifyError(data.error ?? "Le signalement n'a pas pu être envoyé");
      return false;
    }
    notifySuccess(`${AGENCY_ALERT_LABELS[input.kind]} signalée au directeur`);
    return true;
  } catch {
    notifyError("Le signalement n'a pas pu être envoyé");
    return false;
  }
}
