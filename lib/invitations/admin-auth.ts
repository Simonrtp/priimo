import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/** Vérifie le secret admin pour les invitations directeur (header Authorization: Bearer …). */
export function requireInvitationAdmin(request: Request): NextResponse | null {
  const secret = process.env.INVITATION_ADMIN_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      { error: 'INVITATION_ADMIN_SECRET non configuré sur le serveur.' },
      { status: 503 },
    );
  }

  const header = request.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token || !safeEqual(token, secret)) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  }

  return null;
}
