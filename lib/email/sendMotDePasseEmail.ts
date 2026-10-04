import { Resend } from 'resend';
import { renderInvitationEmailHtml } from '@/lib/email/invitation-email-layout';
import { LIEN_VALIDITE_LIBELLE } from '@/lib/auth/mot-de-passe';

const FROM_ADDRESS = 'Priimo <hello@priimo.fr>';

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL?.trim() || 'https://priimo.fr').replace(/\/$/, '');
}

async function envoyer(to: string, subject: string, html: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) throw new Error('RESEND_API_KEY manquante.');
  const { error } = await new Resend(apiKey).emails.send({ from: FROM_ADDRESS, to, subject, html });
  if (error) throw new Error(`Resend: ${error.message ?? "erreur d'envoi"}`);
}

/** Le lien pour choisir un nouveau mot de passe. */
export async function sendReinitialisationEmail(params: { to: string; lien: string }): Promise<void> {
  const html = renderInvitationEmailHtml({
    title: 'Choisissez un nouveau mot de passe',
    inviteUrl: params.lien,
    ctaLabel: 'Choisir mon mot de passe',
    footnote: `Ce lien est valable ${LIEN_VALIDITE_LIBELLE} et ne sert qu'une fois. Si vous n'avez rien demandé, ignorez cet email : votre mot de passe actuel reste valable.`,
    bodyHtml: `
              <p style="margin:0;font-size:15px;line-height:1.55;color:#111827;">
                Une demande de nouveau mot de passe a été faite pour votre compte Priimo.
                Cliquez sur le bouton ci-dessous pour en choisir un.
              </p>`,
  });
  await envoyer(params.to, 'Votre nouveau mot de passe Priimo', html);
}

/** Après le changement : si ce n'était pas l'agent, il le sait tout de suite. */
export async function sendMotDePasseChangeEmail(params: { to: string }): Promise<void> {
  const quand = new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'Europe/Paris',
  }).format(new Date());
  const html = renderInvitationEmailHtml({
    title: 'Votre mot de passe a été changé',
    inviteUrl: `${siteUrl()}/mot-de-passe/oublie`,
    ctaLabel: 'Ce n’était pas moi',
    footnote:
      'Si vous êtes à l’origine de ce changement, il n’y a rien à faire. Sinon, choisissez tout de suite un nouveau mot de passe et prévenez votre directeur.',
    bodyHtml: `
              <p style="margin:0;font-size:15px;line-height:1.55;color:#111827;">
                Le mot de passe de votre compte Priimo a été changé le ${quand}.
                Vos autres appareils ont été déconnectés.
              </p>`,
  });
  await envoyer(params.to, 'Votre mot de passe Priimo a été changé', html);
}
