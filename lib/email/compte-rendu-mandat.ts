/**
 * Le compte rendu tel que le vendeur le reçoit.
 *
 * Ton volontairement factuel : des chiffres, puis une conclusion assumée. Un
 * compte rendu qui enrobe la mauvaise nouvelle ne sert à rien — c'est
 * justement parce qu'il ose dire « le prix bloque » qu'il fait gagner le
 * renouvellement du mandat.
 *
 * Rien ne part d'ici tout seul : l'envoi est déclenché par la validation
 * explicite d'une proposition.
 */

import { Resend } from 'resend';
import type { CompteRendu } from '@/lib/automations/compte-rendu';
import { escapeHtml } from '@/lib/email/invitation-email-layout';
import { formatEuro } from '@/lib/estimation/resultat';

const ACCENT = '#E8743C';
const INK = '#111827';
const MUTE = '#6B7280';
const FROM_ADDRESS = 'Priimo <hello@priimo.fr>';

const PORTAIL_LABELS: Record<string, string> = {
  seloger: 'SeLoger',
  bienici: 'Bien’ici',
  logicimmo: 'Logic-Immo',
  leboncoin: 'leboncoin',
};

function portailLisible(id: string): string {
  return PORTAIL_LABELS[id] ?? id;
}

/** « août 2026 » à partir de la période `2026-08`. */
export function periodeLisible(periode: string): string {
  const mois = [
    'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
    'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
  ];
  const m = periode.match(/^(\d{4})-(\d{2})$/);
  if (!m) return periode;
  return `${mois[Number(m[2]) - 1] ?? periode} ${m[1]}`;
}

export function sujetCompteRendu(cr: CompteRendu): string {
  return `Votre bien, ${cr.adresse} — point de ${periodeLisible(cr.periode)}`;
}

function ligneChiffre(libelle: string, valeur: string): string {
  return `<tr>
    <td style="padding:10px 0;border-bottom:1px solid #F3F4F6;color:${MUTE};font-size:14px;">${escapeHtml(libelle)}</td>
    <td style="padding:10px 0;border-bottom:1px solid #F3F4F6;color:${INK};font-size:15px;font-weight:600;text-align:right;">${escapeHtml(valeur)}</td>
  </tr>`;
}

/** Version texte — certains vendeurs lisent leurs mails sans HTML. */
export function renderCompteRenduTexte(cr: CompteRendu, agenceNom: string): string {
  const lignes = [
    `Votre bien : ${cr.adresse}`,
    `Point de ${periodeLisible(cr.periode)}`,
    '',
    cr.prixAffiche !== null ? `Prix affiché : ${formatEuro(cr.prixAffiche)}` : null,
    cr.portails.length > 0 ? `Diffusion : ${cr.portails.map(portailLisible).join(', ')}` : 'Diffusion : pas encore en ligne',
    cr.joursEnLigne !== null ? `En ligne depuis : ${cr.joursEnLigne} jours` : null,
    `Visites : ${cr.visites}`,
    `Offres reçues : ${cr.offres}`,
    cr.meilleureOffre !== null ? `Meilleure offre : ${formatEuro(cr.meilleureOffre)}` : null,
    '',
    'Notre analyse',
    cr.recommandation.motif,
    cr.recommandation.sens === 'baisser' && cr.recommandation.prixConseille !== null
      ? `Prix conseillé : ${formatEuro(cr.recommandation.prixConseille)}`
      : null,
    '',
    agenceNom,
  ];
  return lignes.filter((l) => l !== null).join('\n');
}

export function renderCompteRenduHtml(cr: CompteRendu, agenceNom: string): string {
  const salutation = cr.proprietaireName ? `Bonjour ${escapeHtml(cr.proprietaireName)},` : 'Bonjour,';

  const chiffres = [
    cr.prixAffiche !== null ? ligneChiffre('Prix affiché', formatEuro(cr.prixAffiche)) : '',
    ligneChiffre(
      'Diffusion',
      cr.portails.length > 0 ? cr.portails.map(portailLisible).join(', ') : 'Pas encore en ligne',
    ),
    cr.joursEnLigne !== null ? ligneChiffre('En ligne depuis', `${cr.joursEnLigne} jours`) : '',
    ligneChiffre('Visites', String(cr.visites)),
    ligneChiffre('Offres reçues', String(cr.offres)),
    cr.meilleureOffre !== null ? ligneChiffre('Meilleure offre', formatEuro(cr.meilleureOffre)) : '',
  ].join('');

  const conseil =
    cr.recommandation.sens === 'baisser' && cr.recommandation.prixConseille !== null
      ? `<p style="margin:16px 0 0;font-size:16px;color:${INK};">
           Prix conseillé : <strong>${escapeHtml(formatEuro(cr.recommandation.prixConseille))}</strong>
         </p>`
      : '';

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${escapeHtml(sujetCompteRendu(cr))}</title>
</head>
<body style="margin:0;padding:0;background:#FAFAF9;font-family:'Inter','Helvetica Neue',Arial,sans-serif;color:${INK};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#FAFAF9;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 1px 2px rgba(0,0,0,0.04);">
          <tr>
            <td style="background:${ACCENT};padding:24px 32px;color:#FFFFFF;font-weight:700;font-size:20px;letter-spacing:-0.03em;">
              ${escapeHtml(agenceNom)}
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 8px;font-size:15px;color:${INK};">${salutation}</p>
              <h1 style="margin:0 0 4px;font-size:22px;line-height:1.3;color:${INK};">
                ${escapeHtml(cr.adresse)}
              </h1>
              <p style="margin:0 0 24px;font-size:14px;color:${MUTE};">
                Point de ${escapeHtml(periodeLisible(cr.periode))}
              </p>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                ${chiffres}
              </table>

              <div style="margin-top:28px;padding:20px;background:#FAFAF9;border-radius:12px;">
                <p style="margin:0 0 8px;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;color:${MUTE};">
                  Notre analyse
                </p>
                <p style="margin:0;font-size:15px;line-height:1.6;color:${INK};">
                  ${escapeHtml(cr.recommandation.motif)}
                </p>
                ${conseil}
              </div>

              <p style="margin:28px 0 0;font-size:14px;line-height:1.6;color:${MUTE};">
                Je reste à votre disposition pour en parler de vive voix.
              </p>
              <p style="margin:8px 0 0;font-size:14px;color:${INK};font-weight:600;">
                ${escapeHtml(agenceNom)}
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

/**
 * Envoie le compte rendu au mandant. Ne part que sur validation explicite.
 * Lève en cas d'échec : l'appelant doit pouvoir dire à l'agent que le mail
 * n'est pas parti, jamais lui laisser croire le contraire.
 */
export async function sendCompteRenduMandat(
  cr: CompteRendu,
  agenceNom: string,
): Promise<void> {
  if (!cr.proprietaireEmail) {
    throw new Error("Aucune adresse email connue pour le propriétaire.");
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('RESEND_API_KEY manquante.');
  }

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM?.trim() || FROM_ADDRESS,
    to: cr.proprietaireEmail,
    subject: sujetCompteRendu(cr),
    html: renderCompteRenduHtml(cr, agenceNom),
    text: renderCompteRenduTexte(cr, agenceNom),
  });

  if (error) {
    throw new Error(`Envoi impossible : ${error.message}`);
  }
}
