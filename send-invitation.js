import { Resend } from 'resend';

const resend = new Resend('re_votre_cle_api_resend');

async function sendInvitation(email, token, role, agencyName) {
  const inviteUrl = `https://priimo.fr/invite?token=${token}`;
  
  const subject = role === 'directeur' 
    ? 'Bienvenue sur Priimo — Créez votre compte'
    : `Invitation à rejoindre ${agencyName} sur Priimo`;
  
  const html = `
    <h2>Bienvenue sur Priimo</h2>
    <p>Vous êtes invité(e) à ${role === 'directeur' ? 'créer votre agence' : 'rejoindre ' + agencyName} sur Priimo.</p>
    <p><a href="${inviteUrl}" style="background: #E8743C; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Créer mon compte</a></p>
    <p style="color: #666; font-size: 14px;">Ce lien expire dans 7 jours.</p>
    <p style="color: #666; font-size: 14px;">Si vous n'avez pas demandé cette invitation, ignorez cet email.</p>
  `;

  const { data, error } = await resend.emails.send({
    from: 'Priimo <onboarding@priimo.fr>',  // Ou 'onboarding@resend.dev' en test
    to: email,
    subject: subject,
    html: html,
  });

  if (error) {
    console.error('Erreur envoi email:', error);
  } else {
    console.log('Email envoyé avec succès:', data);
  }
}

// Exemple d'utilisation
sendInvitation(
  'directeur@test.com',
  'dir_abc123xyz789',
  'directeur',
  null
);