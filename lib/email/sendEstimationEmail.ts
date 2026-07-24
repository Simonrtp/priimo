import { Resend } from 'resend';
import { escapeHtml } from '@/lib/email/invitation-email-layout';
import { getAdminEmail } from '@/lib/auth/requireAdmin';

const FROM_ADDRESS = 'Priimo <hello@priimo.fr>';

const TIMELINE_LABELS: Record<string, string> = {
  '3_mois': 'Dans les 3 mois',
  '6_mois': 'Dans les 6 mois',
  '1_an': "D'ici un an",
  renseignement: 'Je me renseigne simplement',
};

export type EstimationEmailParams = {
  firstName: string;
  lastName: string;
  civility: string | null;
  phone: string;
  email: string;
  address: string;
  postalCode: string;
  propertyType: string;
  surfaceM2: number;
  rooms: number;
  saleTimeline: string;
  isOwner: boolean;
  residenceType: string;
  estimationAvailable: boolean;
  estimationLow: number | null;
  estimationValue: number | null;
  estimationHigh: number | null;
};

export async function sendEstimationNotificationToAdmin(
  params: EstimationEmailParams,
): Promise<void> {
  const adminEmail = getAdminEmail();
  if (!adminEmail) {
    throw new Error('ADMIN_EMAIL manquant.');
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('RESEND_API_KEY manquante.');
  }

  const timeline =
    TIMELINE_LABELS[params.saleTimeline] ?? params.saleTimeline;
  const estimateBlock = params.estimationAvailable
    ? `${params.estimationLow?.toLocaleString('fr-FR')} – ${params.estimationValue?.toLocaleString('fr-FR')} – ${params.estimationHigh?.toLocaleString('fr-FR')} €`
    : 'Non calculée (CP sans référentiel) — recontact conseiller';

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
      <h1 style="font-size:20px;color:#111827;margin:0 0 16px;">Nouvelle demande d'estimation</h1>
      <div style="background:#FFF7F0;border:1px solid rgba(232,116,60,0.35);border-radius:12px;padding:14px 16px;margin:0 0 20px;">
        <p style="margin:0;font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#C25E2C;">Délai de vente</p>
        <p style="margin:6px 0 0;font-size:18px;font-weight:700;color:#0A0D11;">${escapeHtml(timeline)}</p>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:14px;color:#111827;">
        <tr><td style="padding:6px 0;color:#6B7280;width:140px;">Contact</td><td><strong>${escapeHtml([params.civility, params.firstName, params.lastName].filter(Boolean).join(' '))}</strong></td></tr>
        <tr><td style="padding:6px 0;color:#6B7280;">Téléphone</td><td><a href="tel:${escapeHtml(params.phone)}">${escapeHtml(params.phone)}</a></td></tr>
        <tr><td style="padding:6px 0;color:#6B7280;">Email</td><td><a href="mailto:${escapeHtml(params.email)}">${escapeHtml(params.email)}</a></td></tr>
        <tr><td style="padding:6px 0;color:#6B7280;">Adresse</td><td>${escapeHtml(params.address)} (${escapeHtml(params.postalCode)})</td></tr>
        <tr><td style="padding:6px 0;color:#6B7280;">Bien</td><td>${escapeHtml(params.propertyType)} · ${params.surfaceM2} m² · ${params.rooms} pièces</td></tr>
        <tr><td style="padding:6px 0;color:#6B7280;">Propriétaire</td><td>${params.isOwner ? 'Oui' : 'Non'}</td></tr>
        <tr><td style="padding:6px 0;color:#6B7280;">Occupation</td><td>${escapeHtml(params.residenceType)}</td></tr>
        <tr><td style="padding:6px 0;color:#6B7280;">Estimation</td><td>${escapeHtml(estimateBlock)}</td></tr>
      </table>
    </div>`;

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: adminEmail,
    subject: `[Priimo] Estimation — ${timeline} — ${params.firstName} ${params.lastName}`,
    html,
  });
  if (error) {
    throw new Error(`Resend: ${error.message ?? "erreur d'envoi"}`);
  }
}
