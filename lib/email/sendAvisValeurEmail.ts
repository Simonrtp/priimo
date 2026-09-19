import { Resend } from 'resend';
import { escapeHtml } from '@/lib/email/invitation-email-layout';

const FROM_ADDRESS = 'Priimo <hello@priimo.fr>';

export async function sendAvisValeurEmail(input: {
  to: string;
  agentNom: string;
  agenceNom: string;
  bienLabel: string | null;
  pdf: Uint8Array;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) throw new Error('RESEND_API_KEY manquante.');

  const sujet = input.bienLabel
    ? `Avis de valeur — ${input.bienLabel}`
    : 'Avis de valeur';
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111827;">
      <p style="margin:0 0 12px;font-size:15px;">Bonjour,</p>
      <p style="margin:0 0 12px;font-size:14px;line-height:1.5;">
        ${escapeHtml(input.agentNom)} vous adresse l’avis de valeur
        ${input.bienLabel ? `concernant ${escapeHtml(input.bienLabel)}` : 'de votre bien'}.
      </p>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.5;">
        Le document est joint à cet e-mail, au format PDF.
      </p>
      <p style="margin:0;font-size:13px;color:#6B7280;">${escapeHtml(input.agenceNom)}</p>
    </div>`;

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: input.to,
    subject: sujet,
    html,
    attachments: [
      {
        filename: 'avis-de-valeur.pdf',
        content: Buffer.from(input.pdf),
      },
    ],
  });
  if (error) throw new Error(error.message);
}
