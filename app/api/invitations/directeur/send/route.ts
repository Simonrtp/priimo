import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    { error: 'Les invitations directeur sont retirées. Utilisez /inscription.' },
    { status: 410 },
  );
}
