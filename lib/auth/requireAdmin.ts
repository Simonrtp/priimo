import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';

export function getAdminEmail(): string | null {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  return email || null;
}

export function isAdminEmail(email: string | null | undefined): boolean {
  const admin = getAdminEmail();
  if (!admin || !email) return false;
  return email.trim().toLowerCase() === admin;
}

export type RequireAdminResult =
  | { ok: true; user: { id: string; email: string } }
  | { ok: false; response: NextResponse };

export async function requireAdmin(): Promise<RequireAdminResult> {
  const adminEmail = getAdminEmail();
  if (!adminEmail) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'ADMIN_EMAIL non configuré sur le serveur.' },
        { status: 503 },
      ),
    };
  }

  const { user } = await getServerUser();
  if (!user || !isAdminEmail(user.email)) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Accès réservé à l\'administrateur.' }, { status: 403 }),
    };
  }

  return { ok: true, user };
}
