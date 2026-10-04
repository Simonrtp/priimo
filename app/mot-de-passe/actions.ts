'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { clientIpFromRequest, pruneRateLimitBuckets, rateLimit } from '@/lib/rate-limit';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { normalizeInviteEmail } from '@/lib/invitations/validate';
import {
  lienReinitialisation,
  messageErreurMotDePasse,
  verifierNouveauMotDePasse,
} from '@/lib/auth/mot-de-passe';
import { sendMotDePasseChangeEmail, sendReinitialisationEmail } from '@/lib/email/sendMotDePasseEmail';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Jeton déjà échangé contre une session : si le nouveau mot de passe est
 * refusé (trop faible, déjà fuité), l'agent réessaie sans redemander de
 * lien. Le cookie retient à qui appartient la session, pour ne jamais changer
 * le mot de passe d'un autre compte resté connecté sur l'appareil.
 */
const COOKIE_REPRISE = 'priimo_reinit';

async function ipDuClient(): Promise<string> {
  return clientIpFromRequest(new Request('http://mot-de-passe', { headers: await headers() }));
}

/**
 * L'adresse du site. En production, jamais déduite de la requête : un en-tête
 * Host forgé détournerait le lien vers un autre site. En local, celle du
 * serveur de dev, pour pouvoir tester le parcours de bout en bout.
 */
async function siteUrl(): Promise<string> {
  if (process.env.NODE_ENV !== 'production') {
    const h = await headers();
    const hote = h.get('host');
    if (hote) return `http://${hote}`;
  }
  return (process.env.NEXT_PUBLIC_SITE_URL?.trim() || 'https://priimo.fr').replace(/\/$/, '');
}

/**
 * Même réponse, que le compte existe ou non, et le travail part après la
 * réponse : ni le message ni le temps de réponse ne disent si une adresse a
 * un compte Priimo.
 */
export async function demanderReinitialisation(formData: FormData): Promise<void> {
  const email = normalizeInviteEmail(String(formData.get('email') ?? ''));
  if (!email || !EMAIL_REGEX.test(email)) {
    redirect('/mot-de-passe/oublie?erreur=email');
  }

  pruneRateLimitBuckets();
  const ip = await ipDuClient();
  const parIp = rateLimit(`reinit:ip:${ip}`, { limit: 5, windowMs: 15 * 60 * 1000 });
  const parEmail = rateLimit(`reinit:email:${email}`, { limit: 3, windowMs: 60 * 60 * 1000 });
  if (!parIp.ok || !parEmail.ok) {
    redirect('/mot-de-passe/oublie?erreur=rate');
  }

  const base = await siteUrl();
  after(async () => {
    try {
      const admin = createSupabaseAdminClient();
      const { data, error } = await admin.auth.admin.generateLink({ type: 'recovery', email });
      const jeton = data?.properties?.hashed_token;
      // Adresse inconnue : on ne dit rien, à personne.
      if (error || !jeton) return;
      await sendReinitialisationEmail({
        to: data.user?.email ?? email,
        lien: lienReinitialisation(base, jeton),
      });
    } catch (err) {
      console.error('[mot-de-passe] envoi du lien', err);
    }
  });

  redirect('/mot-de-passe/oublie?envoye=1');
}

export type EtatNouveauMotDePasse = { erreur: string; lienExpire?: boolean } | null;

export async function definirNouveauMotDePasse(
  _precedent: EtatNouveauMotDePasse,
  formData: FormData,
): Promise<EtatNouveauMotDePasse> {
  const jeton = String(formData.get('jeton') ?? '').trim();
  const motDePasse = String(formData.get('motDePasse') ?? '');
  const confirmation = String(formData.get('confirmation') ?? '');

  const invalide = verifierNouveauMotDePasse(motDePasse, confirmation);
  if (invalide) return { erreur: invalide };

  pruneRateLimitBuckets();
  const rl = rateLimit(`reinit:nouveau:${await ipDuClient()}`, { limit: 10, windowMs: 15 * 60 * 1000 });
  if (!rl.ok) return { erreur: 'Trop de tentatives. Réessayez dans quelques minutes.' };

  const supabase = await createSupabaseServerClient();
  const cookieStore = await cookies();

  let userId: string | null = null;
  let email: string | null = null;
  if (jeton) {
    const { data, error } = await supabase.auth.verifyOtp({ type: 'recovery', token_hash: jeton });
    if (!error && data.user) {
      userId = data.user.id;
      email = data.user.email ?? null;
      cookieStore.set(COOKIE_REPRISE, userId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/mot-de-passe',
        maxAge: 15 * 60,
      });
    }
  }
  if (!userId) {
    // Jeton déjà échangé lors d'un essai précédent : on reprend la session
    // ouverte alors, si c'est bien la même personne.
    const reprise = cookieStore.get(COOKIE_REPRISE)?.value;
    const { data } = await supabase.auth.getUser();
    if (reprise && data.user?.id === reprise) {
      userId = data.user.id;
      email = data.user.email ?? null;
    }
  }
  if (!userId) {
    return { erreur: 'Ce lien a expiré ou a déjà servi. Demandez-en un nouveau.', lienExpire: true };
  }

  const { error } = await supabase.auth.updateUser({ password: motDePasse });
  if (error) return { erreur: messageErreurMotDePasse(error) };

  cookieStore.delete({ name: COOKIE_REPRISE, path: '/mot-de-passe' });
  // Un mot de passe oublié est parfois un compte volé : les autres appareils sortent.
  await supabase.auth.signOut({ scope: 'others' }).catch(() => undefined);
  if (email) {
    const destinataire = email;
    after(() =>
      sendMotDePasseChangeEmail({ to: destinataire }).catch((err) =>
        console.error('[mot-de-passe] confirmation', err),
      ),
    );
  }

  revalidatePath('/', 'layout');
  redirect('/dashboard');
}
