import { Resend } from 'resend';

const FROM_ADDRESS = 'Priimo <invitations@priimo.fr>';

const ACCENT = '#E8743C';
const INK = '#111827';
const MUTE = '#6B7280';

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

interface SendInvitationParams {
  to: string;
  token: string;
  agencyName: string;
  directorFirstName: string;
  directorLastName: string;
}

function renderInvitationHtml(params: SendInvitationParams, inviteUrl: string): string {
  const safeAgency = escapeHtml(params.agencyName);
  const safeDirector = escapeHtml(`${params.directorFirstName} ${params.directorLastName}`.trim());
  const safeUrl = escapeHtml(inviteUrl);
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
                Bienvenue dans l'équipe ${safeAgency}
              </h1>
              <p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:${INK};">
                ${safeDirector}, directeur de ${safeAgency}, vous invite à rejoindre son agence sur Priimo,
                la plateforme de prospection immobilière prédictive.
              </p>
              <p style="margin:0 0 24px;font-size:14px;line-height:1.55;color:${MUTE};">
                Cliquez sur le bouton ci-dessous pour créer votre compte et accéder à votre tableau de bord.
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td align="center" bgcolor="${ACCENT}" style="border-radius:10px;">
                    <a href="${safeUrl}" target="_blank" style="display:inline-block;padding:14px 24px;font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;">
                      Créer mon compte
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0;font-size:12px;line-height:1.55;color:${MUTE};">
                Ce lien expire dans 7 jours. Si vous n'avez pas demandé cette invitation, ignorez cet email.
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

export async function sendInvitationEmail(params: SendInvitationParams): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('RESEND_API_KEY manquante.');
  }
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() ?? 'https://priimo.fr';
  const inviteUrl = `${siteUrl.replace(/\/$/, '')}/invite?token=${encodeURIComponent(params.token)}`;
  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: params.to,
    subject: `Vous êtes invité(e) à rejoindre ${params.agencyName} sur Priimo`,
    html: renderInvitationHtml(params, inviteUrl),
  });
  if (error) {
    throw new Error(`Resend: ${error.message ?? "erreur d'envoi"}`);
  }
}
