import { Resend } from 'resend';

const FROM_ADDRESS = 'Priimo <invitations@priimo.fr>';

/** Palette alignée sur tailwind.config.ts */
const C = {
  accent: '#E8743C',
  accentDark: '#C25E2C',
  blue: '#3D5A80',
  canvas: '#FAFAF9',
  softWarm: '#FFF3EA',
  softGray: '#F1F1EE',
  white: '#FFFFFF',
  ink: '#111827',
  mute: '#6B7280',
  border: 'rgba(17, 24, 39, 0.08)',
} as const;

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
<html lang="fr" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>Invitation Priimo — ${safeAgency}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    @media only screen and (max-width: 620px) {
      .wrapper { padding: 16px 12px !important; }
      .card-pad { padding: 28px 22px !important; }
      .h1 { font-size: 22px !important; }
      .cta-cell { display: block !important; width: 100% !important; }
      .cta-link { display: block !important; text-align: center !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:${C.canvas};font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;color:${C.ink};">
  <!-- Préheader (aperçu boîte mail) -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${C.canvas};">
    ${safeDirector} vous invite à rejoindre ${safeAgency} sur Priimo — créez votre compte en un clic.
  </div>

  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="wrapper" style="background:${C.canvas};padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:520px;">
          <!-- En-tête marque -->
          <tr>
            <td align="center" style="padding-bottom:24px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="font-size:22px;font-weight:700;letter-spacing:-0.04em;color:${C.ink};line-height:1;">
                    Priimo
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-top:6px;font-size:11px;font-weight:500;letter-spacing:0.12em;text-transform:uppercase;color:${C.mute};">
                    Prospection immobilière prédictive
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Carte principale -->
          <tr>
            <td>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${C.white};border-radius:20px;border:1px solid ${C.border};overflow:hidden;box-shadow:0 1px 2px rgba(17,24,39,0.04),0 8px 24px rgba(17,24,39,0.06);">
                <!-- Bandeau chaleur -->
                <tr>
                  <td bgcolor="${C.accent}" style="height:4px;background-color:${C.accent};background:linear-gradient(90deg,${C.accent} 0%,${C.accentDark} 50%,${C.blue} 100%);font-size:0;line-height:0;">
                    &nbsp;
                  </td>
                </tr>
                <tr>
                  <td class="card-pad" style="padding:36px 32px 32px;">
                    <p style="margin:0 0 8px;font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:${C.accent};">
                      Invitation équipe
                    </p>
                    <h1 class="h1" style="margin:0 0 20px;font-size:26px;font-weight:700;line-height:1.25;letter-spacing:-0.03em;color:${C.ink};">
                      Rejoignez l&rsquo;&eacute;quipe<br />
                      <span style="color:${C.blue};">${safeAgency}</span>
                    </h1>

                    <!-- Bloc citation directeur -->
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom:28px;">
                      <tr>
                        <td style="background:${C.softWarm};border-radius:12px;border-left:3px solid ${C.accent};padding:16px 18px;">
                          <p style="margin:0;font-size:15px;line-height:1.6;color:${C.ink};">
                            <strong style="font-weight:600;">${safeDirector}</strong>, directeur de <strong style="font-weight:600;">${safeAgency}</strong>, vous invite à collaborer sur Priimo&nbsp;: identifiez les vendeurs avant qu&rsquo;ils ne soient sur le marché.
                          </p>
                        </td>
                      </tr>
                    </table>

                    <p style="margin:0 0 28px;font-size:14px;line-height:1.6;color:${C.mute};">
                      Créez votre compte en quelques minutes pour accéder aux prospects scorés de votre agence.
                    </p>

                    <!-- CTA -->
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                      <tr>
                        <td align="center" class="cta-cell">
                          <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                            <tr>
                              <td align="center" bgcolor="${C.accent}" style="border-radius:12px;background:${C.accent};box-shadow:0 6px 20px rgba(232,116,60,0.28);">
                                <a href="${safeUrl}" target="_blank" class="cta-link" style="display:inline-block;padding:16px 32px;font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;letter-spacing:-0.01em;">
                                  Créer mon compte &rarr;
                                </a>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>

                    <p style="margin:28px 0 0;font-size:12px;line-height:1.55;color:${C.mute};text-align:center;">
                      Le bouton ne fonctionne pas&nbsp;? Copiez ce lien dans votre navigateur&nbsp;:<br />
                      <a href="${safeUrl}" target="_blank" style="color:${C.accent};word-break:break-all;text-decoration:underline;">${safeUrl}</a>
                    </p>
                  </td>
                </tr>

                <!-- Pied de carte -->
                <tr>
                  <td style="background:${C.softGray};padding:16px 32px;border-top:1px solid ${C.border};">
                    <p style="margin:0;font-size:12px;line-height:1.5;color:${C.mute};text-align:center;">
                      Ce lien expire dans <strong style="color:${C.ink};font-weight:600;">7&nbsp;jours</strong>. Si vous n&rsquo;attendiez pas cette invitation, ignorez cet email.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding:24px 8px 0;">
              <p style="margin:0;font-size:12px;line-height:1.5;color:${C.mute};">
                <a href="https://priimo.fr" target="_blank" style="color:${C.blue};text-decoration:none;font-weight:500;">priimo.fr</a>
                <span style="color:#D1D5DB;">&nbsp;&middot;&nbsp;</span>
                Prospection immobilière prédictive
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function renderInvitationText(params: SendInvitationParams, inviteUrl: string): string {
  const director = `${params.directorFirstName} ${params.directorLastName}`.trim();
  return [
    `Invitation Priimo — ${params.agencyName}`,
    '',
    `${director}, directeur de ${params.agencyName}, vous invite à rejoindre son agence sur Priimo.`,
    '',
    'Créez votre compte :',
    inviteUrl,
    '',
    'Ce lien expire dans 7 jours.',
    '',
    '— Priimo · priimo.fr',
  ].join('\n');
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
    text: renderInvitationText(params, inviteUrl),
  });
  if (error) {
    throw new Error(`Resend: ${error.message ?? "erreur d'envoi"}`);
  }
}
