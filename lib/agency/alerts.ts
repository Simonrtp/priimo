export const AGENCY_ALERT_KINDS = ['baisse_prix', 'mandat_a_recuperer'] as const;

export type AgencyAlertKind = (typeof AGENCY_ALERT_KINDS)[number];

export const AGENCY_ALERT_LABELS: Record<AgencyAlertKind, string> = {
  baisse_prix: 'Baisse de prix',
  mandat_a_recuperer: 'Mandat à récupérer',
};

export function isAgencyAlertKind(value: unknown): value is AgencyAlertKind {
  return typeof value === 'string' && (AGENCY_ALERT_KINDS as readonly string[]).includes(value);
}
