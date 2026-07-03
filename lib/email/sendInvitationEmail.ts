import { Resend } from 'resend';
import {
  buildInviteUrl,
  escapeHtml,
  renderInvitationEmailHtml,
} from '@/lib/email/invitation-email-layout';

const FROM_ADDRESS = 'Priimo <invitations@priimo.fr>';

interface CollaboratorInvitationParams {
  to: string;
  token: string;
  agencyName: string;
  directorFirstName: string;
  directorLastName: string;
}

interface DirectorInvitationParams {
  to: string;
  token: string;
  agencyName: string;
}

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('RESEND_API_KEY manquante.');
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

/** Email quand un directeur invite un collaborateur. */
export async function sendInvitationEmail(params: CollaboratorInvitationParams): Promise<void> {
  const safeAgency = escapeHtml(params.agencyName);
  const safeDirector = escapeHtml(`${params.directorFirstName} ${params.directorLastName}`.trim());
  const inviteUrl = buildInviteUrl(params.token);

  const html = renderInvitationEmailHtml({
    title: `Bienvenue dans l'équipe ${safeAgency}`,
    inviteUrl,
    bodyHtml: `
              <p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:#111827;">
                ${safeDirector} vous a ouvert un accès à Priimo, l'outil que votre agence utilise
                pour repérer, avant les autres, les biens de votre secteur sur le point d'être mis en vente.
              </p>
              <p style="margin:0 0 8px;font-size:14px;line-height:1.55;color:#111827;">
                Concrètement, dès la connexion vous trouverez :
              </p>
              <ul style="margin:0 0 12px;padding-left:20px;font-size:14px;line-height:1.7;color:#111827;">
                <li>Vos leads du secteur, classés par priorité (un score par adresse)</li>
                <li>Pour chaque bien, le signal qui explique pourquoi il remonte (DPE récent, succession, dissolution…)</li>
                <li>Une carte pour organiser vos tournées de prospection sur le terrain</li>
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

/** Email quand un admin invite un directeur d'agence. */
export async function sendDirectorInvitationEmail(params: DirectorInvitationParams): Promise<void> {
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
