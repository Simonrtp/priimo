'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createServerClient } from '@supabase/ssr';
import { clientIpFromRequest, pruneRateLimitBuckets, rateLimit } from '@/lib/rate-limit';
import { getSupabaseAnonKey, getSupabaseUrl } from '@/lib/supabase/env';
import { normalizeInviteEmail } from '@/lib/invitations/validate';
import type { Database } from '@/types/database';

async function createLoginClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        toSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options);
        });
      },
    },
  });
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function loginAction(formData: FormData) {
  const email = normalizeInviteEmail(String(formData.get('email') ?? ''));
  const password = String(formData.get('password') ?? '');

  if (!email || !EMAIL_REGEX.test(email) || !password) {
    redirect('/login?erreur=identifiants');
  }

  pruneRateLimitBuckets();
  const ip = clientIpFromRequest(new Request('http://login', { headers: await headers() }));
  const rl = rateLimit(`login:${ip}`, { limit: 20, windowMs: 15 * 60 * 1000 });
  if (!rl.ok) {
    redirect('/login?erreur=rate');
  }

  const supabase = await createLoginClient();
  try {
    await supabase.auth.signOut({ scope: 'local' });
  } catch {
    // Session déjà invalide (refresh token réutilisé) — on écrase les cookies au sign-in.
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    const code = error.code ?? '';
    const msg = error.message.toLowerCase();
    if (code === 'email_not_confirmed' || msg.includes('not confirmed')) {
      redirect('/login?erreur=confirmation');
    }
    if (code === 'over_request_rate_limit' || msg.includes('rate')) {
      redirect('/login?erreur=rate');
    }
    redirect('/login?erreur=identifiants');
  }

  revalidatePath('/', 'layout');
  redirect('/dashboard');
}
