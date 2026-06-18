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

export function buildInviteUrl(token: string): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() ?? 'https://priimo.fr';
  return `${siteUrl.replace(/\/$/, '')}/invite?token=${encodeURIComponent(token)}`;
}

type InvitationEmailContent = {
  title: string;
  bodyHtml: string;
  inviteUrl: string;
};

export function renderInvitationEmailHtml(content: InvitationEmailContent): string {
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
