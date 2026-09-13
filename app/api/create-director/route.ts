import { NextResponse } from 'next/server';

/** L’inscription autonome a remplacé le token directeur. */
export async function POST() {
  return NextResponse.json(
    { error: 'Les invitations directeur sont retirées. Utilisez /inscription.' },
    { status: 410 },
  );
}
