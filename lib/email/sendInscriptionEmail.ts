import { Resend } from 'resend';
import { escapeHtml } from '@/lib/email/invitation-email-layout';
import { getAdminEmail } from '@/lib/auth/requireAdmin';

const FROM_ADDRESS = 'Priimo <hello@priimo.fr>';

export async function sendInscriptionNotificationToAdmin(params: {
  prenom: string;
  nom: string;
  email: string;
  telephone: string;
  agencyName: string;
  address: string;
  codesPostaux: string[];
}): Promise<void> {
  const adminEmail = getAdminEmail();
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!adminEmail || !apiKey) return;

  const codes = params.codesPostaux.map((c) => escapeHtml(c)).join(', ');
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://priimo.fr').replace(/\/$/, '');
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
      <h1 style="font-size:20px;color:#111827;margin:0 0 16px;">Nouvelle inscription</h1>
      <p style="margin:0 0 12px;font-size:14px;line-height:1.55;color:#374151;">
        <strong>${escapeHtml(params.prenom)} ${escapeHtml(params.nom)}</strong>
        — ${escapeHtml(params.email)} — ${escapeHtml(params.telephone)}
      </p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;color:#111827;">
        <tr><td style="padding:6px 0;color:#6B7280;width:140px;">Agence</td><td><strong>${escapeHtml(params.agencyName)}</strong></td></tr>
        <tr><td style="padding:6px 0;color:#6B7280;">Adresse</td><td>${escapeHtml(params.address)}</td></tr>
        <tr><td style="padding:6px 0;color:#6B7280;">Secteur</td><td>${codes}</td></tr>
      </table>
      <p style="margin:24px 0 0;font-size:13px;color:#6B7280;">
        Traiter dans <a href="${escapeHtml(`${site}/admin/agencies`)}">/admin/agencies</a>
      </p>
    </div>`;

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: adminEmail,
    subject: `[Priimo] Inscription — ${params.agencyName}`,
    html,
  });
  if (error) throw new Error(error.message);
}
