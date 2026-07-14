import { Resend } from 'resend';
import { escapeHtml } from '@/lib/email/invitation-email-layout';
import { getAdminEmail } from '@/lib/auth/requireAdmin';

const FROM_ADDRESS = 'Priimo <hello@priimo.fr>';

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('RESEND_API_KEY manquante.');
  }

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({ from: FROM_ADDRESS, to, subject, html });
  if (error) {
    throw new Error(`Resend: ${error.message ?? "erreur d'envoi"}`);
  }
}

export type AgencyRequestEmailParams = {
  requesterName: string;
  requesterEmail: string;
  currentAgencyName: string;
  agencyName: string;
  address: string;
  codesPostaux: string[];
  message?: string | null;
};

/** Notifie Simon d'une nouvelle demande de secteur. */
export async function sendAgencyRequestNotificationToAdmin(
  params: AgencyRequestEmailParams,
): Promise<void> {
  const adminEmail = getAdminEmail();
  if (!adminEmail) {
    throw new Error('ADMIN_EMAIL manquant.');
  }

  const codes = params.codesPostaux.map((c) => escapeHtml(c)).join(', ');
  const msgBlock = params.message?.trim()
    ? `<p style="margin:16px 0 0;font-size:14px;line-height:1.55;color:#111827;"><strong>Message :</strong><br>${escapeHtml(params.message.trim())}</p>`
    : '';

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
      <h1 style="font-size:20px;color:#111827;margin:0 0 16px;">Nouvelle demande de secteur</h1>
      <p style="margin:0 0 12px;font-size:14px;line-height:1.55;color:#374151;">
        <strong>${escapeHtml(params.requesterName)}</strong> (${escapeHtml(params.requesterEmail)})
        — agence actuelle : <strong>${escapeHtml(params.currentAgencyName)}</strong>
      </p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;color:#111827;">
        <tr><td style="padding:6px 0;color:#6B7280;width:140px;">Agence demandée</td><td><strong>${escapeHtml(params.agencyName)}</strong></td></tr>
        <tr><td style="padding:6px 0;color:#6B7280;">Adresse</td><td>${escapeHtml(params.address)}</td></tr>
        <tr><td style="padding:6px 0;color:#6B7280;">Codes postaux</td><td>${codes}</td></tr>
      </table>
      ${msgBlock}
      <p style="margin:24px 0 0;font-size:13px;color:#6B7280;">
        Traiter dans <a href="${escapeHtml((process.env.NEXT_PUBLIC_SITE_URL ?? 'https://priimo.fr').replace(/\/$/, '') + '/admin/agencies')}">/admin/agencies</a>
      </p>
    </div>`;

  await sendEmail(adminEmail, `[Priimo] Demande secteur — ${params.agencyName}`, html);
}

/** Informe le directeur que son secteur est actif. */
export async function sendAgencyActivatedEmail(params: {
  to: string;
  directorFirstName: string;
  agencyName: string;
}): Promise<void> {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://priimo.fr').replace(/\/$/, '');
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
      <h1 style="font-size:20px;color:#111827;margin:0 0 16px;">Votre nouveau secteur est actif</h1>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:#111827;">
        Bonjour ${escapeHtml(params.directorFirstName)},
      </p>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:#111827;">
        Votre secteur <strong>${escapeHtml(params.agencyName)}</strong> est maintenant disponible sur Priimo.
        Connectez-vous pour basculer vers cette agence depuis votre tableau de bord.
      </p>
      <p style="margin:0;">
        <a href="${escapeHtml(siteUrl + '/dashboard/settings')}" style="display:inline-block;background:#E8743C;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:600;font-size:14px;">
          Accéder au dashboard
        </a>
      </p>
    </div>`;

  await sendEmail(params.to, `Votre secteur ${params.agencyName} est actif — Priimo`, html);
}
