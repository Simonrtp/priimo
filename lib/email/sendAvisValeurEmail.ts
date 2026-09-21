import { Resend } from 'resend';
import { escapeHtml } from '@/lib/email/invitation-email-layout';

const FROM_ADDRESS = 'hello@priimo.fr';
const ACCENT = '#E8743C';

function nomExpediteur(agentNom: string, agenceNom: string): string {
  const agent = agentNom.trim();
  const agence = agenceNom.trim();
  if (agent && agence) return `${agent} · ${agence}`;
  return agent || agence || 'Priimo';
}

function htmlDepuisTexte(texte: string): string {
  return escapeHtml(texte).replace(/\r\n|\n|\r/g, '<br />');
}

export async function sendAvisValeurEmail(input: {
  to: string;
  agentNom: string;
  agenceNom: string;
  replyTo: string;
  message: string;
  lien: string;
  bienLabel: string | null;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) throw new Error('RESEND_API_KEY manquante.');

  const sujet = input.bienLabel
    ? `Avis de valeur — ${input.bienLabel}`
    : 'Avis de valeur';
  const fromName = nomExpediteur(input.agentNom, input.agenceNom);
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111827;">
      <div style="margin:0 0 20px;font-size:15px;line-height:1.55;">${htmlDepuisTexte(input.message)}</div>
      <p style="margin:0 0 20px;">
        <a href="${escapeHtml(input.lien)}"
           style="display:inline-block;background:${ACCENT};color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:10px 16px;border-radius:10px;">
          Consulter l’avis de valeur
        </a>
      </p>
      <p style="margin:0;font-size:13px;color:#6B7280;">
        ${escapeHtml(fromName)}
      </p>
    </div>`;

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: `${fromName} <${FROM_ADDRESS}>`,
    to: input.to,
    replyTo: input.replyTo,
    subject: sujet,
    html,
  });
  if (error) throw new Error(error.message);
}
