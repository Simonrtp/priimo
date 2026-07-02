import { Resend } from 'resend';
import { buildInviteUrl } from '@/lib/utils/format';

/**
 * Envoi des emails d'invitation depuis l'admin.
 * Templates identiques à ceux de l'app principale (lib/email/ côté priimo.fr)
 * pour qu'une relance renvoie exactement le même email que l'original.
 */

const FROM_ADDRESS = 'Priimo <invitations@priimo.fr>';

const ACCENT = '#E8743C';
const INK = '#111827';
const MUTE = '#6B7280';

export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderInvitationEmailHtml(content: {
  title: string;
  bodyHtml: string;
  inviteUrl: string;
}): string {
  const safeTitle = escapeHtml(content.title);
  const safeUrl = escapeHtml(content.inviteUrl);

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Invitation Priimo</title>
</head>
<body style="margin:0;padding:0;background:#FAFAF9;font-family:'Inter','Helvetica Neue',Arial,sans-serif;color:${INK};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#FAFAF9;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 1px 2px rgba(0,0,0,0.04);">
          <tr>
            <td style="background:${ACCENT};padding:24px 32px;color:#FFFFFF;font-weight:700;font-size:24px;letter-spacing:-0.03em;">
              Priimo
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;color:${INK};">
                ${safeTitle}
              </h1>
              ${content.bodyHtml}
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-top:24px;">
                <tr>
                  <td align="center" bgcolor="${ACCENT}" style="border-radius:10px;">
                    <a href="${safeUrl}" target="_blank" style="display:inline-block;padding:14px 24px;font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;">
                      Créer mon compte
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0;font-size:12px;line-height:1.55;color:${MUTE};">
                Si vous n'avez pas demandé cette invitation, ignorez cet email.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#FAFAF9;padding:16px 32px;font-size:12px;color:${MUTE};text-align:center;">
              Priimo — Prospection immobilière prédictive — priimo.fr
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('RESEND_API_KEY manquante dans priimo-admin/.env.local.');
  }

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to,
    subject,
    html,
  });

  if (error) {
    throw new Error(`Resend: ${error.message ?? "erreur d'envoi"}`);
  }
}

/** Email d'invitation collaborateur — même contenu que celui envoyé par l'app. */
export async function sendCollaboratorInvitationEmail(params: {
  to: string;
  token: string;
  agencyName: string;
  directorFullName: string | null;
}): Promise<void> {
  const safeAgency = escapeHtml(params.agencyName);
  const inviteUrl = buildInviteUrl(params.token);

  const intro = params.directorFullName
    ? `${escapeHtml(params.directorFullName)} vous a ouvert un accès à Priimo, l'outil que votre agence utilise
                pour repérer, avant les autres, les biens de votre secteur sur le point d'être mis en vente.`
    : `L'agence ${safeAgency} vous a ouvert un accès à Priimo, l'outil qu'elle utilise
                pour repérer, avant les autres, les biens de votre secteur sur le point d'être mis en vente.`;

  const html = renderInvitationEmailHtml({
    title: `Bienvenue dans l'équipe ${safeAgency}`,
    inviteUrl,
    bodyHtml: `
              <p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:#111827;">
                ${intro}
              </p>
              <p style="margin:0 0 8px;font-size:14px;line-height:1.55;color:#111827;">
                Concrètement, dès la connexion vous trouverez :
              </p>
              <ul style="margin:0 0 12px;padding-left:20px;font-size:14px;line-height:1.7;color:#111827;">
                <li>Vos leads du secteur, classés par priorité (un score par adresse)</li>
                <li>Pour chaque bien, le signal qui explique pourquoi il remonte (DPE récent, succession, dissolution…)</li>
                <li>Une carte pour organiser vos tournées et votre boîtage ciblé</li>
              </ul>
              <p style="margin:0 0 16px;font-size:12px;line-height:1.5;color:#6B7280;">
                Sur les particuliers&nbsp;: coordonnées propriétaire prochainement (conformité RGPD en cours).
              </p>
              <p style="margin:0;font-size:14px;line-height:1.55;color:#6B7280;">
                Créez votre compte en un clic ci-dessous — un guide de 30 secondes vous accueille à la première connexion.
              </p>`,
  });

  await sendEmail(
    params.to,
    `Vous êtes invité(e) à rejoindre ${params.agencyName} sur Priimo`,
    html,
  );
}

/** Email d'invitation directeur — même contenu que celui envoyé par l'app. */
export async function sendDirectorInvitationEmail(params: {
  to: string;
  token: string;
  agencyName: string;
}): Promise<void> {
  const safeAgency = escapeHtml(params.agencyName);
  const inviteUrl = buildInviteUrl(params.token);

  const html = renderInvitationEmailHtml({
    title: `Créez votre agence sur Priimo`,
    inviteUrl,
    bodyHtml: `
              <p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:#111827;">
                Vous êtes invité(e) à rejoindre Priimo en tant que directeur de <strong>${safeAgency}</strong> —
                la plateforme de prospection immobilière prédictive.
              </p>
              <p style="margin:0;font-size:14px;line-height:1.55;color:#6B7280;">
                Cliquez sur le bouton ci-dessous pour créer votre compte, configurer votre secteur et accéder à vos premières adresses prioritaires.
              </p>`,
  });

  await sendEmail(
    params.to,
    `Créez votre compte Priimo — ${params.agencyName}`,
    html,
  );
}
