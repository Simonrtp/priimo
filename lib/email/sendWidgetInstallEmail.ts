import { Resend } from 'resend';
import { escapeHtml } from '@/lib/email/invitation-email-layout';

/**
 * Le code d'intégration, envoyé à qui s'occupe du site.
 *
 * La plupart des agences n'éditent pas leur site elles-mêmes : c'est un
 * prestataire, une agence web, ou l'éditeur du site métier. Cet email lui
 * parle directement — ce qu'il doit coller, où, et comment vérifier — et
 * répond au directeur, pour qu'il reste dans la boucle.
 */

const FROM_ADDRESS = 'Priimo <hello@priimo.fr>';
const ACCENT = '#E8743C';
const INK = '#111827';
const MUTE = '#6B7280';

export type WidgetInstallEmailParams = {
  to: string;
  /** Nom affiché du widget, tel que le visiteur le verra. */
  agencyName: string;
  /** Le directeur qui demande l'installation — mis en réponse. */
  senderName: string;
  senderEmail: string;
  /** Mot libre ajouté par le directeur, facultatif. */
  message: string | null;
  snippet: string;
  pageUrl: string;
  allowedDomains: readonly string[];
};

function domainsBlock(domains: readonly string[]): string {
  if (domains.length === 0) {
    return `<p style="margin:0;font-size:14px;line-height:1.6;color:${INK};">
      Aucun domaine n'est encore autorisé. Répondez à cet email en indiquant l'adresse
      du site : le formulaire ne se chargera nulle part tant qu'elle n'est pas déclarée.
    </p>`;
  }
  return `<p style="margin:0;font-size:14px;line-height:1.6;color:${INK};">
      Le formulaire ne se charge que depuis ${domains.length > 1 ? 'ces domaines' : 'ce domaine'} :
      <strong>${domains.map((d) => escapeHtml(d)).join(', ')}</strong>${
        domains.length > 1 ? '' : ' (sous-domaines compris)'
      }.
      Sur toute autre adresse, il refusera de s'afficher — c'est voulu.
    </p>`;
}

export function renderWidgetInstallEmailHtml(params: WidgetInstallEmailParams): string {
  const safeAgency = escapeHtml(params.agencyName);
  const safeSender = escapeHtml(params.senderName);
  const safeSnippet = escapeHtml(params.snippet);
  const safeUrl = escapeHtml(params.pageUrl);

  const messageBlock = params.message?.trim()
    ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 24px;background:#FFF7F0;border-radius:12px;">
         <tr><td style="padding:14px 16px;">
           <p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#C25E2C;">Message de ${safeSender}</p>
           <p style="margin:0;font-size:14px;line-height:1.6;color:${INK};white-space:pre-wrap;">${escapeHtml(params.message.trim())}</p>
         </td></tr>
       </table>`
    : '';

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Code à intégrer — ${safeAgency}</title>
</head>
<body style="margin:0;padding:0;background:#FAFAF9;font-family:'Inter','Helvetica Neue',Arial,sans-serif;color:${INK};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#FAFAF9;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:620px;background:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 1px 2px rgba(0,0,0,0.04);">
        <tr>
          <td style="background:${ACCENT};padding:24px 32px;color:#FFFFFF;font-weight:700;font-size:24px;letter-spacing:-0.03em;">
            Priimo
          </td>
        </tr>
        <tr><td style="padding:32px;">
          <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;color:${INK};">
            Formulaire d'estimation à installer sur le site de ${safeAgency}
          </h1>
          <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:${MUTE};">
            ${safeSender} vous transmet le code du formulaire d'estimation à ajouter au site.
            Deux lignes à coller, aucune bibliothèque à installer, aucune dépendance à gérer.
            Le formulaire s'affiche dans la page et s'adapte à sa largeur.
          </p>

          ${messageBlock}

          <h2 style="margin:0 0 8px;font-size:16px;color:${INK};">1. Le code</h2>
          <p style="margin:0 0 10px;font-size:14px;line-height:1.6;color:${MUTE};">
            À placer à l'endroit exact où le formulaire doit apparaître.
          </p>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 24px;background:#F5F5F4;border-radius:10px;">
            <tr><td style="padding:14px 16px;">
              <pre style="margin:0;font-family:'SFMono-Regular',Consolas,'Liberation Mono',monospace;font-size:13px;line-height:1.6;color:${INK};white-space:pre-wrap;word-break:break-all;">${safeSnippet}</pre>
            </td></tr>
          </table>

          <h2 style="margin:0 0 8px;font-size:16px;color:${INK};">2. Où le coller</h2>
          <ul style="margin:0 0 24px;padding-left:20px;font-size:14px;line-height:1.7;color:${INK};">
            <li><strong>WordPress</strong> — bloc « HTML personnalisé » dans la page, ou un widget HTML.</li>
            <li><strong>Webflow</strong> — élément « Embed » posé dans la section voulue.</li>
            <li><strong>Wix</strong> — Ajouter &rsaquo; Intégrations &rsaquo; Code HTML, en mode « Code ».</li>
            <li><strong>Netty, Hektor, La Boîte Immo</strong> — zone « contenu libre » ou « HTML » d'une page.</li>
            <li><strong>Site fait main</strong> — n'importe où dans le <code>&lt;body&gt;</code>.</li>
          </ul>

          <h2 style="margin:0 0 8px;font-size:16px;color:${INK};">3. Bon à savoir</h2>
          ${domainsBlock(params.allowedDomains)}
          <p style="margin:10px 0 0;font-size:14px;line-height:1.6;color:${INK};">
            Aperçu du rendu, sans rien installer :
            <a href="${safeUrl}" target="_blank" style="color:${ACCENT};">${safeUrl}</a>
          </p>
          <p style="margin:10px 0 0;font-size:14px;line-height:1.6;color:${MUTE};">
            Une fois en ligne, ${safeSender} verra dans Priimo que le formulaire s'est chargé.
            Une question sur l'intégration&nbsp;? Répondez à cet email.
          </p>
        </td></tr>
        <tr>
          <td style="background:#FAFAF9;padding:16px 32px;font-size:12px;color:${MUTE};text-align:center;">
            Priimo — Prospection immobilière prédictive — priimo.fr
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function sendWidgetInstallEmail(params: WidgetInstallEmailParams): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('RESEND_API_KEY manquante.');
  }

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: params.to,
    replyTo: params.senderEmail,
    subject: `Formulaire d'estimation à intégrer — ${params.agencyName}`,
    html: renderWidgetInstallEmailHtml(params),
  });

  if (error) {
    throw new Error(error.message ?? "L'email n'a pas pu être envoyé.");
  }
}
